import 'dotenv/config'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { addMinutes } from 'date-fns'
import { app, ipcMain, powerMonitor, screen } from 'electron'
import { DAILY_TASKS_ID_PREFIX, TaskRollupScheduler, isDailyTaskRollupId } from './scheduler/task-rollup'
import { DailyTaskRollupRepository } from './storage/task-rollup-repository'
import { nextOccurrence } from '../shared/reminders/recurrence'
import { createDatabase } from './storage/database'
import { SyncRepository } from './storage/sync-repository'
import { ReminderRepository } from './storage/reminder-repository'
import { PreferencesRepository } from './storage/preferences-repository'
import { showPopupWindow } from './windows/popup-window'
import { hideOverlay, markOverlayReady, resetOverlayAfterFailure, setOverlayIgnoreMouseEvents, showOverlay } from './windows/overlay-window'
import { createTray } from './tray/tray'
import { ReminderScheduler } from './scheduler/reminder-scheduler'
import { logger } from './logging/logger'
import { complete, dismiss, snooze } from '../shared/reminders/state'
import { validateReminderInput } from '../shared/validation/reminder'
import { SecureTokenStore } from './storage/secure-token-store'
import { createGoogleCalendarClient, GoogleCalendarSyncService } from './sync/google/calendar-sync'
import { createGoogleTasksClient, GoogleTasksSyncService } from './sync/google/tasks-sync'
import { exchangeGoogleCode, openGoogleAuthorization } from './sync/google/oauth'
import type { CalendarInfo } from '../shared/types/calendar'
import type { GoogleTaskList } from './sync/google/tasks-sync'
import type { SyncStatus } from '../shared/types/sync'
import { isCreateReminderInput, isPreferencesPatch, isReminderAction, isReminderId, isUpdateReminderInput } from '../shared/validation/runtime'
import type { CreateReminderInput } from '../shared/types/reminder'

let reminderRepository: ReminderRepository
let preferencesRepository: PreferencesRepository
let scheduler: ReminderScheduler
let tokenStore: SecureTokenStore
let syncRepository: SyncRepository
let selectedCalendarIds: string[] = []
let selectedTaskListIds: string[] = []
let calendarCache: CalendarInfo[] = []
let taskListCache: GoogleTaskList[] = []
let lastSyncAt: string | undefined
let syncError: string | undefined
let syncTimer: NodeJS.Timeout | undefined
let rollupRepository: DailyTaskRollupRepository
let taskRollupScheduler: TaskRollupScheduler
let rollupTimer: NodeJS.Timeout | undefined
// True while the daily task roll-up owns the overlay window (walking + idle pause
// + exit). Timed reminders defer until it finishes so the two never fight over
// the single overlay.
let rollupShowing = false
const previewReminderIds = new Set<string>()

function overlayAssetBaseUrl(): string | undefined {
  if (!app.isPackaged || process.env.ELECTRON_RENDERER_URL) return undefined
  return pathToFileURL(join(process.resourcesPath)).href
}

function applyRecurringAdvance(reminder: import('../shared/types/reminder').Reminder): void {
  if (!reminder.repeatRule) return
  const next = nextOccurrence(reminder.startAt, reminder.repeatRule, reminder.timezone, new Date(reminder.startAt))
  if (next) reminderRepository.createNextOccurrence(reminder, next)
}

function reconcileRecurringReminders(now = new Date()): void {
  const reminders = reminderRepository.list()
  const latestBySeries = new Map<string, (typeof reminders)[number]>()
  for (const reminder of reminders) {
    if (!reminder.repeatRule) continue
    const seriesId = reminder.seriesId ?? reminder.id
    const latest = latestBySeries.get(seriesId)
    if (!latest || new Date(reminder.startAt) > new Date(latest.startAt)) latestBySeries.set(seriesId, reminder)
  }
  for (const reminder of latestBySeries.values()) {
    if (!reminder.enabled) continue
    const hasFutureOccurrence = reminders.some((candidate) => candidate.seriesId === (reminder.seriesId ?? reminder.id) && new Date(candidate.startAt) > now && candidate.status !== 'dismissed' && candidate.status !== 'completed')
    if (!hasFutureOccurrence && new Date(reminder.startAt) <= now) applyRecurringAdvance(reminder)
  }
}

function googleClientConfig(tokens: NonNullable<ReturnType<typeof tokenStore.load>>) {
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  return { clientId, clientSecret, redirectUri: 'http://127.0.0.1', accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
}

async function runConfiguredSync(): Promise<void> {
  const preferences = preferencesRepository.get()
  const tokens = tokenStore.load()
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!preferences.syncEnabled || !tokens || !clientId || !clientSecret) return
  try {
    const config = googleClientConfig(tokens)
    const calendarClient = createGoogleCalendarClient(config)

    // Sync calendars
    calendarCache = await calendarClient.listCalendars()
    const calendarSelected = selectedCalendarIds.length
      ? selectedCalendarIds
      : calendarCache.filter((calendar) => calendar.primary).map((calendar) => calendar.id)
    if (calendarSelected.length) {
      await new GoogleCalendarSyncService(reminderRepository, calendarClient).sync(calendarSelected)
      selectedCalendarIds = calendarSelected
    }

    // Sync tasks (only if task lists were explicitly selected)
    const tasksClient = createGoogleTasksClient(config)
    taskListCache = await tasksClient.listTaskLists()
    const taskSelected = selectedTaskListIds
    if (taskSelected.length) {
      await new GoogleTasksSyncService(reminderRepository, tasksClient).sync(taskSelected)
    }

    lastSyncAt = new Date().toISOString()
    syncRepository.save({ selectedCalendarIds: calendarSelected, selectedTaskListIds: taskSelected, lastSuccessAt: lastSyncAt })
    syncError = undefined
    logger.info('Google sync completed', { calendars: calendarSelected.length, taskLists: taskSelected.length })
  } catch (error) {
    syncError = error instanceof Error ? error.message : 'Google sync failed.'
    logger.error('Google sync failed', error)
  }
}

function isGoogleSource(source: string): boolean {
  return source === 'google-calendar' || source === 'google-tasks'
}

function registerIpc(): void {
  ipcMain.handle('reminders:list', () => reminderRepository.list())
  ipcMain.handle('reminders:create', (_event, input: unknown) => {
    if (!isCreateReminderInput(input)) throw new Error('Invalid reminder input.')
    const errors = validateReminderInput(input)
    if (errors.length) throw new Error(errors.join(' '))
    return reminderRepository.create(input)
  })
  ipcMain.handle('reminders:update', (_event, id: unknown, input: unknown) => {
    if (!isReminderId(id) || !isUpdateReminderInput(input)) throw new Error('Invalid reminder update.')
    const current = reminderRepository.get(id)
    if (!current) return null
    if (isGoogleSource(current.source) && Object.keys(input).some((key) => key !== 'enabled')) {
      throw new Error('Synced reminders are read-only. Disable or manage this item in Google.')
    }
    const errors = validateReminderInput({ ...current, ...input })
    if (errors.length) throw new Error(errors.join(' '))
    return reminderRepository.update(id, input)
  })
  ipcMain.handle('reminders:remove', (_event, id: unknown) => {
    if (!isReminderId(id)) throw new Error('Invalid reminder ID.')
    const reminder = reminderRepository.get(id)
    if (reminder && isGoogleSource(reminder.source)) throw new Error('Synced reminders are read-only. Remove this item in Google.')
    return reminderRepository.remove(id)
  })
  ipcMain.handle('reminders:action', (_event, id: unknown, action: unknown) => {
    if (!isReminderId(id) || !isReminderAction(action)) throw new Error('Invalid reminder action.')
    const current = reminderRepository.get(id)
    if (!current) return null
    if (action === 'snooze') {
      reminderRepository.clearTriggered(id)
      return reminderRepository.update(id, snooze(current, preferencesRepository.get().snoozeMinutes))
    }
    if (action === 'dismiss') {
      const updated = reminderRepository.update(id, dismiss(current))
      applyRecurringAdvance(current)
      return updated
    }
    const updated = reminderRepository.update(id, complete(current))
    applyRecurringAdvance(current)
    return updated
  })
  ipcMain.handle('preferences:get', () => preferencesRepository.get())
  ipcMain.handle('sync:status', (): SyncStatus => ({
    connected: Boolean(tokenStore.load()),
    calendars: calendarCache,
    selectedCalendarIds,
    lastSyncAt,
    error: syncError
  }))
  ipcMain.handle('sync:connect', async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('Google credentials are not configured.')
    const authorization = await openGoogleAuthorization({ clientId, clientSecret })
    const tokens = await exchangeGoogleCode({ clientId, clientSecret, code: authorization.code, redirectUri: authorization.redirectUri })
    tokenStore.save(tokens)
    const config = googleClientConfig(tokens)

    // Fetch calendars
    const calendarClient = createGoogleCalendarClient(config)
    calendarCache = await calendarClient.listCalendars()
    selectedCalendarIds = calendarCache.filter((calendar) => calendar.primary).map((calendar) => calendar.id)

    // Fetch task lists
    const tasksClient = createGoogleTasksClient(config)
    taskListCache = await tasksClient.listTaskLists()
    selectedTaskListIds = taskListCache.map((list) => list.id)

    syncRepository.save({ selectedCalendarIds, selectedTaskListIds })
    syncError = undefined

    // Run initial sync immediately
    if (selectedCalendarIds.length) {
      await new GoogleCalendarSyncService(reminderRepository, calendarClient).sync(selectedCalendarIds)
    }
    if (selectedTaskListIds.length) {
      await new GoogleTasksSyncService(reminderRepository, tasksClient).sync(selectedTaskListIds)
    }
    lastSyncAt = new Date().toISOString()
    syncRepository.save({ selectedCalendarIds: selectedCalendarIds, selectedTaskListIds, lastSuccessAt: lastSyncAt })

    return { connected: true, calendars: calendarCache }
  })
  ipcMain.handle('sync:select-calendars', (_event, calendarIds: unknown) => {
    if (!Array.isArray(calendarIds) || calendarIds.some((id) => typeof id !== 'string')) throw new Error('Invalid calendar selection.')
    selectedCalendarIds = calendarIds
    syncRepository.save({ selectedCalendarIds, selectedTaskListIds, lastSuccessAt: lastSyncAt })
    return { connected: Boolean(tokenStore.load()), calendars: calendarCache, selectedCalendarIds, lastSyncAt, error: syncError }
  })
  ipcMain.handle('sync:refresh', async () => {
    const tokens = tokenStore.load()
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!tokens || !clientId || !clientSecret) throw new Error('Connect your Google account before syncing.')
    const config = googleClientConfig(tokens)
    try {
      // Refresh calendars
      const calendarClient = createGoogleCalendarClient(config)
      calendarCache = await calendarClient.listCalendars()
      const calendarSelected = selectedCalendarIds.length
        ? selectedCalendarIds
        : calendarCache.filter((calendar) => calendar.primary).map((calendar) => calendar.id)
      const calendarResult = calendarSelected.length
        ? await new GoogleCalendarSyncService(reminderRepository, calendarClient).sync(calendarSelected)
        : { imported: 0, updated: 0, skipped: 0, syncedAt: new Date().toISOString() }

      // Refresh tasks (only if task lists were explicitly selected)
      const tasksClient = createGoogleTasksClient(config)
      taskListCache = await tasksClient.listTaskLists()
      const taskSelected = selectedTaskListIds
      const tasksResult = taskSelected.length
        ? await new GoogleTasksSyncService(reminderRepository, tasksClient).sync(taskSelected)
        : { imported: 0, updated: 0, skipped: 0, syncedAt: new Date().toISOString() }

      selectedCalendarIds = calendarSelected
      selectedTaskListIds = taskSelected
      lastSyncAt = calendarResult.syncedAt
      syncRepository.save({ selectedCalendarIds: calendarSelected, selectedTaskListIds: taskSelected, lastSuccessAt: lastSyncAt })
      syncError = undefined

      return {
        imported: calendarResult.imported + tasksResult.imported,
        updated: calendarResult.updated + tasksResult.updated,
        skipped: 0,
        syncedAt: lastSyncAt,
        calendars: calendarCache
      }
    } catch (error) {
      syncError = error instanceof Error ? error.message : 'Google sync failed.'
      throw new Error(syncError)
    }
  })
  ipcMain.handle('sync:disconnect', () => {
    tokenStore.clear()
    syncRepository.clear()
    preferencesRepository.update({ syncEnabled: false })
    calendarCache = []
    taskListCache = []
    selectedCalendarIds = []
    selectedTaskListIds = []
    lastSyncAt = undefined
    syncError = undefined
    return { connected: false, calendars: [], selectedCalendarIds: [], lastSyncAt, error: undefined }
  })
  ipcMain.handle('preferences:update', (_event, input: unknown) => {
    if (!isPreferencesPatch(input)) throw new Error('Invalid preferences update.')
    const next = preferencesRepository.update(input)
    app.setLoginItemSettings({ openAtLogin: app.isPackaged && next.launchAtLogin, openAsHidden: next.openInTray })
    return next
  })
  ipcMain.handle('app:open-settings', () => { showPopupWindow(); return undefined })
  ipcMain.handle('app:test-overlay', async () => {
    const now = new Date()
    const reminder = reminderRepository.create({ title: 'A tiny cat reminder', description: 'This is a local overlay test.', startAt: new Date(now.getTime() + 5_000).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, priority: 'normal' })
    previewReminderIds.add(reminder.id)
    reminderRepository.markTriggered(reminder.id, now)
    try {
      await showOverlay({ reminder, preview: true, queuedAt: now.toISOString(), assetBaseUrl: overlayAssetBaseUrl(), animationIntensity: preferencesRepository.get().animationIntensity }, 'show')
    } catch (error) {
      previewReminderIds.delete(reminder.id)
      reminderRepository.clearTriggered(reminder.id)
      reminderRepository.remove(reminder.id)
      throw error
    }
  })
  ipcMain.handle('app:quit', () => app.quit())
  ipcMain.on('overlay:ready', (event) => {
    markOverlayReady(event.sender.id)
  })
  ipcMain.on('overlay:set-ignore-mouse-events', (event, ignore: unknown) => {
    if (typeof ignore === 'boolean') setOverlayIgnoreMouseEvents(event.sender.id, ignore)
  })
  ipcMain.on('overlay:animation-complete', (event, id: unknown) => {
    // The daily roll-up walked off without a click: hide it, but leave today's
    // state as 'shown' so it doesn't auto-dismiss the day or immediately re-fire.
    if (typeof id === 'string' && isDailyTaskRollupId(id)) {
      rollupShowing = false
      hideOverlay()
      return
    }
    const isPreview = typeof id === 'string' && previewReminderIds.delete(id)
    if (isPreview && typeof id === 'string') {
      reminderRepository.clearTriggered(id)
      reminderRepository.remove(id)
    }
    if (!event.sender.isDestroyed() && isPreview) {
      hideOverlay()
    }
  })
  ipcMain.on('overlay:action', (_event, id: unknown, action: unknown) => {
    if (!isReminderId(id) || !isReminderAction(action)) return
    // Daily task roll-up: snooze reappears it after the configured snooze window;
    // dismiss hides it for the rest of the day. Individual tasks are untouched.
    if (typeof id === 'string' && isDailyTaskRollupId(id)) {
      rollupShowing = false
      const date = id.slice(DAILY_TASKS_ID_PREFIX.length)
      if (action === 'snooze') {
        rollupRepository.markSnoozed(date, addMinutes(new Date(), preferencesRepository.get().snoozeMinutes).toISOString())
      } else {
        rollupRepository.markDismissed(date)
      }
      hideOverlay()
      return
    }
    if (previewReminderIds.delete(id)) {
      reminderRepository.clearTriggered(id)
      reminderRepository.remove(id)
      hideOverlay()
      return
    }
    const current = reminderRepository.get(id)
    if (!current) return
    if (action === 'snooze') {
      reminderRepository.clearTriggered(id)
      reminderRepository.update(id, snooze(current, preferencesRepository.get().snoozeMinutes))
    }
    if (action === 'dismiss') { reminderRepository.update(id, dismiss(current)); applyRecurringAdvance(current) }
    if (action === 'complete') { reminderRepository.update(id, complete(current)); applyRecurringAdvance(current) }
    hideOverlay()
    scheduler.completeActive()
  })
}

async function boot(): Promise<void> {
  if (process.platform === 'win32') app.setAppUserModelId('com.catreminder.desktop')
  const db = createDatabase()
  reminderRepository = new ReminderRepository(db)
  preferencesRepository = new PreferencesRepository(db)
  tokenStore = new SecureTokenStore()
  syncRepository = new SyncRepository(db)
  const syncMetadata = syncRepository.get()
  selectedCalendarIds = syncMetadata.selectedCalendarIds
  selectedTaskListIds = syncMetadata.selectedTaskListIds
  lastSyncAt = syncMetadata.lastSuccessAt

  // Set default sync interval to 5 minutes if not already configured
  const prefs = preferencesRepository.get()
  if (prefs.syncIntervalMinutes === 30) {
    preferencesRepository.update({ syncIntervalMinutes: 5 })
  }

  app.setLoginItemSettings({ openAtLogin: app.isPackaged && prefs.launchAtLogin, openAsHidden: prefs.openInTray })
  scheduler = new ReminderScheduler(reminderRepository, () => preferencesRepository.get().reminderLeadTimeMinutes)
  scheduler.onTrigger((reminder) => {
    logger.info('Reminder trigger', { id: reminder.id, title: reminder.title })
    // The daily task roll-up has the overlay; don't replace it mid-walk.
    if (rollupShowing) {
      logger.info('Daily task roll-up active; deferring timed reminder', { id: reminder.id, title: reminder.title })
      scheduler.deferActive()
      setTimeout(() => scheduler.retryDeferred(), 30_000)
      return
    }
    const preferences = preferencesRepository.get()
    if (preferences.fullscreenPolicy === 'suppress') {
      logger.info('Overlay suppressed by user policy', { id: reminder.id })
      scheduler.completeActive()
      return
    }
    void showOverlay({ reminder, queuedAt: new Date().toISOString(), assetBaseUrl: overlayAssetBaseUrl(), animationIntensity: preferences.animationIntensity }, preferences.fullscreenPolicy)
      .then((shown) => {
        if (!shown) {
          logger.info('Overlay deferred by fullscreen policy', { id: reminder.id })
          scheduler.deferActive()
          setTimeout(() => scheduler.retryDeferred(), 30_000)
          return
        }
        logger.info('Overlay displayed', { id: reminder.id, title: reminder.title })
      })
      .catch((error) => {
        resetOverlayAfterFailure()
        logger.error('Overlay show failed; retrying', error)
        scheduler.deferActive()
        setTimeout(() => scheduler.retryDeferred(), 30_000)
      })
  })
  registerIpc()
  createTray()
  reconcileRecurringReminders()
  scheduler.start()

  // Daily task roll-up: at the configured time each day, show all time-less tasks
  // for the day as one cat overlay. Checks every 30s and once at boot (so a late
  // launch still shows today's list if it hasn't been shown or dismissed yet).
  rollupRepository = new DailyTaskRollupRepository(db)
  taskRollupScheduler = new TaskRollupScheduler({
    repository: reminderRepository,
    state: rollupRepository,
    preferences: () => preferencesRepository.get(),
    isQueueIdle: () => scheduler.isIdle(),
    assetBaseUrl: overlayAssetBaseUrl,
    show: async (payload, policy) => {
      const shown = await showOverlay(payload, policy)
      if (shown) rollupShowing = true
      return shown
    }
  })
  const checkRollup = () => taskRollupScheduler.check()
  checkRollup()
  rollupTimer = setInterval(checkRollup, 30_000)

  // Auto-sync timer: check every 60s if sync interval has elapsed
  syncTimer = setInterval(() => {
    const intervalMs = preferencesRepository.get().syncIntervalMinutes * 60_000
    if (!lastSyncAt || Date.now() - new Date(lastSyncAt).getTime() >= intervalMs) {
      void runConfiguredSync()
    }
  }, 60_000)
  void runConfiguredSync()

  powerMonitor.on('resume', () => { logger.info('System resumed'); reconcileRecurringReminders(); scheduler.reconcile() })
  powerMonitor.on('suspend', () => logger.info('System suspended'))
  screen.on('display-added', () => { logger.info('Display added'); hideOverlay() })
  screen.on('display-removed', () => { logger.info('Display removed'); hideOverlay() })
  screen.on('display-metrics-changed', (_event, _display, _changedMetrics) => { logger.info('Display metrics changed'); hideOverlay() })
  logger.info('Cat Reminder started')
  const tokens = tokenStore.load()
  if (!tokens) showPopupWindow()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showPopupWindow())
  app.whenReady().then(boot).catch((error) => logger.error('Startup failed', error))
}
app.on('window-all-closed', () => { logger.info('All windows closed; keeping Cat Reminder in the tray') })
app.on('before-quit', () => {
  scheduler?.stop()
  if (syncTimer) clearInterval(syncTimer)
  if (rollupTimer) clearInterval(rollupTimer)
  logger.info('Cat Reminder shutting down')
})
