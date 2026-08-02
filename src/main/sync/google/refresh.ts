import type { CalendarInfo } from '../../../shared/types/calendar'
import type { Preferences } from '../../../shared/types/preferences'
import type { SyncResult } from '../../../shared/types/calendar'
import { GoogleCalendarSyncService, type GoogleCalendarClient } from './calendar-sync'
import type { ReminderRepository } from '../../storage/reminder-repository'

export type SyncSnapshot = {
  calendars: CalendarInfo[]
  selectedCalendarIds: string[]
  lastSyncAt?: string
  error?: string
}

export async function refreshGoogleCalendar(
  repository: ReminderRepository,
  client: GoogleCalendarClient,
  snapshot: SyncSnapshot,
  preferences: Preferences,
  now = new Date()
): Promise<SyncResult | null> {
  if (!preferences.syncEnabled || snapshot.selectedCalendarIds.length === 0) return null
  try {
    const result = await new GoogleCalendarSyncService(repository, client).sync(snapshot.selectedCalendarIds, now)
    snapshot.lastSyncAt = result.syncedAt
    snapshot.error = undefined
    return result
  } catch (error) {
    snapshot.error = error instanceof Error ? error.message : 'Google Calendar sync failed.'
    return null
  }
}
