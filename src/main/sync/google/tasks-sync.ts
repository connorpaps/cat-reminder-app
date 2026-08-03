import { google } from 'googleapis'
import type { OAuthTokens } from './oauth'
import { ANYTIME_SENTINEL_START, type Reminder } from '../../../shared/types/reminder'
import { DISPLAY_ONLY_HIDDEN_STATUS, shouldHideProviderReminder } from '../../../shared/display-only'
import { ReminderRepository } from '../../storage/reminder-repository'

export type GoogleTaskItem = {
  id: string
  taskListId: string
  title: string
  notes?: string
  due?: string
  status: string
}

export type GoogleTaskList = {
  id: string
  title: string
}

export type TasksSyncResult = {
  imported: number
  updated: number
  skipped: number
  syncedAt: string
}

export interface GoogleTasksClient {
  listTaskLists(): Promise<GoogleTaskList[]>
  listAllTasks(taskListIds: string[]): Promise<GoogleTaskItem[]>
}

/** Google Tasks date-only tasks use 00:00:00 UTC as their due timestamp. */
function isDateOnlyDue(due: Date): boolean {
  return due.getUTCHours() === 0 && due.getUTCMinutes() === 0 && due.getUTCSeconds() === 0 && due.getUTCMilliseconds() === 0
}

export function taskToReminder(task: GoogleTaskItem, now = new Date()): Reminder {
  const completed = task.status === 'completed'
  const base: Omit<Reminder, 'kind' | 'startAt'> = {
    id: `google-tasks:${task.taskListId}:${task.id}`,
    title: task.title || 'Untitled task',
    description: task.notes,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    priority: 'normal',
    status: completed ? DISPLAY_ONLY_HIDDEN_STATUS : 'upcoming',
    enabled: !completed,
    source: 'google-tasks',
    sourceEventId: task.id,
    sourceCalendarId: task.taskListId,
    endAt: undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }
  // Tasks without a due date are time-less: they feed the daily task roll-up every day.
  if (!task.due) return { ...base, kind: 'anytime', startAt: ANYTIME_SENTINEL_START }
  const due = new Date(task.due)
  // A 00:00:00 UTC due means date-only → 'all-day' at local midnight of that date.
  if (isDateOnlyDue(due)) {
    const localMidnight = new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
    return { ...base, kind: 'all-day', startAt: localMidnight.toISOString() }
  }
  return { ...base, kind: 'timed', startAt: task.due }
}

const IMPORT_WINDOW_MS = 60 * 86_400_000

export class GoogleTasksSyncService {
  constructor(
    private readonly repository: ReminderRepository,
    private readonly client: GoogleTasksClient
  ) {}

  async sync(taskListIds: string[], now = new Date()): Promise<TasksSyncResult> {
    const tasks = await this.client.listAllTasks(taskListIds)
    let imported = 0
    let updated = 0
    let skipped = 0
    const existingById = new Map(
      this.repository.list()
        .filter((item) => item.source === 'google-tasks')
        .map((item) => [`${item.sourceCalendarId}:${item.sourceEventId}`, item])
    )

    const seenKeys = new Set<string>()
    for (const task of tasks) {
      const key = `${task.taskListId}:${task.id}`
      seenKeys.add(key)
      const reminder = taskToReminder(task, now)
      // Timed/all-day tasks are only imported inside the rolling window; time-less
      // ('anytime') tasks always belong to the roll-up.
      if (reminder.kind !== 'anytime' && new Date(reminder.startAt).getTime() > now.getTime() + IMPORT_WINDOW_MS) {
        skipped += 1
        continue
      }
      const existing = existingById.get(`${task.taskListId}:${task.id}`)
      this.repository.upsertImported(reminder)
      if (reminder.status === DISPLAY_ONLY_HIDDEN_STATUS) this.repository.update(reminder.id, { status: DISPLAY_ONLY_HIDDEN_STATUS, enabled: false })
      if (existing) updated += 1
      else imported += 1
    }
    for (const [, existing] of existingById) {
      if (!shouldHideProviderReminder(existing, { provider: 'google-tasks', syncedScopeIds: taskListIds, seenKeys })) continue
      this.repository.update(existing.id, { status: DISPLAY_ONLY_HIDDEN_STATUS, enabled: false })
    }

    return { imported, updated, skipped, syncedAt: now.toISOString() }
  }
}

export function createGoogleTasksClient(config: {
  accessToken: string
  refreshToken?: string
  clientId: string
  clientSecret: string
  redirectUri: string
  onTokens?: (tokens: OAuthTokens) => void
}): GoogleTasksClient {
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
  auth.setCredentials({ access_token: config.accessToken, refresh_token: config.refreshToken })
  auth.on('tokens', (tokens) => config.onTokens?.({
    accessToken: tokens.access_token ?? config.accessToken,
    refreshToken: tokens.refresh_token ?? undefined,
    expiryDate: tokens.expiry_date ?? undefined
  }))
  const tasks = google.tasks({ version: 'v1', auth })

  return {
    async listTaskLists() {
      const response = await tasks.tasklists.list({ maxResults: 100 })
      return (response.data.items ?? []).map((item) => ({
        id: item.id ?? '',
        title: item.title ?? 'Unnamed task list'
      })).filter((item) => item.id)
    },
    async listAllTasks(taskListIds) {
      const items: GoogleTaskItem[] = []
      for (const taskListId of taskListIds) {
        // No dueMax filter: the Google Tasks API excludes tasks without a due date
        // when a due filter is set, and those are exactly the ones we now import
        // as time-less tasks. Filtering happens in the sync service instead.
        const response = await tasks.tasks.list({
          tasklist: taskListId,
          showCompleted: true,
          showHidden: true,
          maxResults: 100
        })
        for (const task of response.data.items ?? []) {
          if (!task.id || !task.title) continue
          items.push({
            id: task.id,
            taskListId,
            title: task.title,
            notes: task.notes ?? undefined,
            due: task.due ?? undefined,
            status: task.status ?? 'needsAction'
          })
        }
      }
      return items
    }
  }
}
