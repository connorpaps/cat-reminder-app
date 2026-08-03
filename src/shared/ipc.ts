import type { CreateReminderInput, Reminder, UpdateReminderInput } from './types/reminder'
import type { Preferences } from './types/preferences'
import type { OverlayAction, OverlayReminder } from './types/overlay'
import type { SyncConnectResult, SyncRefreshResult, SyncStatus, TickTickSyncStatus } from './types/sync'
import type { TickTickSyncResult } from './types/ticktick'

export type ReminderApi = {
  list: () => Promise<Reminder[]>
  create: (input: CreateReminderInput) => Promise<Reminder>
  update: (id: string, input: UpdateReminderInput) => Promise<Reminder | null>
  remove: (id: string) => Promise<boolean>
  action: (id: string, action: Extract<OverlayAction, 'snooze' | 'dismiss' | 'complete'>) => Promise<Reminder | null>
}

export type PreferencesApi = {
  get: () => Promise<Preferences>
  update: (input: Partial<Preferences>) => Promise<Preferences>
}

export type SyncApi = {
  status: () => Promise<SyncStatus>
  connect: () => Promise<SyncConnectResult>
  selectCalendars: (calendarIds: string[]) => Promise<SyncStatus>
  refresh: () => Promise<SyncRefreshResult>
  disconnect: () => Promise<SyncStatus>
}

export type TickTickApi = {
  status: () => Promise<TickTickSyncStatus>
  connect: () => Promise<TickTickSyncStatus>
  selectProjects: (projectIds: string[]) => Promise<TickTickSyncStatus>
  refresh: () => Promise<TickTickSyncResult>
  disconnect: () => Promise<TickTickSyncStatus>
}

export type AppApi = {
  openSettings: () => Promise<void>
  showTestOverlay: () => Promise<void>
  quit: () => Promise<void>
}

export type CatReminderApi = {
  reminders: ReminderApi
  preferences: PreferencesApi
  sync: SyncApi
  ticktick: TickTickApi
  app: AppApi
}

declare global {
  interface Window {
    catReminder: CatReminderApi
    catOverlay: {
      onShow: (listener: (payload: OverlayReminder) => void) => () => void
      action: (id: string, action: 'snooze' | 'dismiss' | 'complete') => void
      ready: () => void
      setIgnoreMouseEvents: (ignore: boolean) => void
      animationComplete: (id: string) => void
    }
  }
}
