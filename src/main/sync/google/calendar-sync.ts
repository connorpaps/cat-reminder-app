import { google } from 'googleapis'
import type { CalendarEvent, CalendarInfo, SyncResult } from '../../../shared/types/calendar'
import type { Reminder } from '../../../shared/types/reminder'
import { DISPLAY_ONLY_HIDDEN_STATUS, shouldHideProviderReminder } from '../../../shared/display-only'
import { ReminderRepository } from '../../storage/reminder-repository'

export interface GoogleCalendarClient {
  listCalendars(): Promise<CalendarInfo[]>
  listUpcomingEvents(calendarIds: string[], timeMin: string, timeMax: string): Promise<CalendarEvent[]>
}

export function calendarEventToReminder(event: CalendarEvent, now = new Date()): Reminder {
  return {
    id: `google:${event.calendarId}:${event.id}`,
    kind: 'timed',
    title: event.title || 'Untitled calendar event',
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone || 'UTC',
    priority: 'normal',
    status: event.status === 'cancelled' ? DISPLAY_ONLY_HIDDEN_STATUS : 'upcoming',
    enabled: event.status !== 'cancelled',
    source: 'google-calendar',
    sourceEventId: event.id,
    sourceCalendarId: event.calendarId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }
}

export class GoogleCalendarSyncService {
  constructor(private readonly repository: ReminderRepository, private readonly client: GoogleCalendarClient) {}

  async sync(calendarIds: string[], now = new Date()): Promise<SyncResult> {
    const events = await this.client.listUpcomingEvents(calendarIds, now.toISOString(), new Date(now.getTime() + 60 * 86_400_000).toISOString())
    let imported = 0
    let updated = 0
    const existingById = new Map(this.repository.list().filter((item) => item.source === 'google-calendar').map((item) => [`${item.sourceCalendarId}:${item.sourceEventId}`, item]))
    const seenKeys = new Set<string>()
    for (const event of events) {
      const key = `${event.calendarId}:${event.id}`
      seenKeys.add(key)
      const existing = existingById.get(key)
      const reminder = calendarEventToReminder(event, now)
      this.repository.upsertImported(reminder)
      if (reminder.status === DISPLAY_ONLY_HIDDEN_STATUS) this.repository.update(reminder.id, { status: DISPLAY_ONLY_HIDDEN_STATUS, enabled: false })
      if (existing) updated += 1
      else imported += 1
    }
    // The API request covers only the next 60 days. Do not hide events outside
    // that window merely because they were not returned by this bounded query.
    const windowStart = now.getTime()
    const windowEnd = now.getTime() + 60 * 86_400_000
    for (const [, existing] of existingById) {
      const startAt = new Date(existing.startAt).getTime()
      if (startAt < windowStart || startAt > windowEnd) continue
      if (!shouldHideProviderReminder(existing, { provider: 'google-calendar', syncedScopeIds: calendarIds, seenKeys })) continue
      this.repository.update(existing.id, { status: DISPLAY_ONLY_HIDDEN_STATUS, enabled: false })
    }
    return { imported, updated, skipped: 0, syncedAt: now.toISOString() }
  }
}

export function createGoogleCalendarClient(config: {
  clientId: string
  clientSecret: string
  redirectUri: string
  accessToken: string
  refreshToken?: string
  onTokens?: (tokens: { accessToken: string; refreshToken?: string; expiryDate?: number }) => void
}): GoogleCalendarClient {
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
  auth.setCredentials({ access_token: config.accessToken, refresh_token: config.refreshToken })
  auth.on('tokens', (tokens) => config.onTokens?.({
    accessToken: tokens.access_token ?? config.accessToken,
    refreshToken: tokens.refresh_token ?? undefined,
    expiryDate: tokens.expiry_date ?? undefined
  }))
  const calendar = google.calendar({ version: 'v3', auth })
  return {
    async listCalendars() {
      const response = await calendar.calendarList.list()
      return (response.data.items ?? []).map((item) => ({
        id: item.id ?? '', summary: item.summary ?? 'Unnamed calendar', primary: item.primary ?? false, backgroundColor: item.backgroundColor ?? undefined
      })).filter((item) => item.id)
    },
    async listUpcomingEvents(calendarIds, timeMin, timeMax) {
      const events: CalendarEvent[] = []
      for (const calendarId of calendarIds) {
        const response = await calendar.events.list({ calendarId, timeMin, timeMax, singleEvents: true, orderBy: 'startTime', showDeleted: true })
        for (const event of response.data.items ?? []) {
          const start = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00.000Z` : undefined)
          if (!event.id || !start) continue
          events.push({
            id: event.id, calendarId, title: event.summary ?? 'Untitled calendar event', description: event.description ?? undefined,
            startAt: new Date(start).toISOString(), endAt: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : undefined,
            timezone: event.start?.timeZone ?? 'UTC', status: event.status ?? undefined, htmlLink: event.htmlLink ?? undefined
          })
        }
      }
      return events
    }
  }
}
