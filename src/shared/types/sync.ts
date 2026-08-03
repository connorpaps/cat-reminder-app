import type { CalendarInfo, SyncResult } from './calendar'
import type { TickTickProject } from './ticktick'

export type SyncStatus = {
  connected: boolean
  calendars: CalendarInfo[]
  selectedCalendarIds: string[]
  lastSyncAt?: string
  error?: string
}

export type TickTickSyncStatus = {
  connected: boolean
  projects: TickTickProject[]
  selectedProjectIds: string[]
  lastSyncAt?: string
  error?: string
}

export type SyncConnectResult = {
  connected: boolean
  calendars: CalendarInfo[]
}

export type SyncRefreshResult = SyncResult & {
  calendars: CalendarInfo[]
}
