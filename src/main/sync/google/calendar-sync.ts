import { randomUUID } from 'node:crypto'
import { google } from 'googleapis'
import type { CalendarEvent, CalendarInfo, SyncResult } from '../../../shared/types/calendar'
import type { Reminder } from '../../../shared/types/reminder'
import { ReminderRepository } from '../../storage/reminder-repository'

export interface GoogleCalendarClient {
  listCalendars(): Promise<CalendarInfo[]>
  listUpcomingEvents(calendarIds: string[], timeMin: string, timeMax: string): Promise<CalendarEvent[]>
}

export function calendarEventToReminder(event: CalendarEvent, now = new Date()): Reminder {
  return {
    id: `google:${event.calendarId}:${event.id}`,
    title: event.title || 'Untitled calendar event',
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone || 'UTC',
    priority: 'normal',
    status: 'upcoming',
    enabled: true,
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
    for (const event of events) {
      const existing = this.repository.list().find((item) => item.sourceEventId === event.id && item.sourceCalendarId === event.calendarId)
      this.repository.upsertImported(calendarEventToReminder(event, now))
      if (existing) updated += 1
      else imported += 1
    }
    return { imported, updated, skipped: 0, syncedAt: now.toISOString() }
  }
}

export function createUnconfiguredCalendarClient(): GoogleCalendarClient {
  return {
    async listCalendars() { return [] },
    async listUpcomingEvents() { return [] }
  }
}

export function createGoogleCalendarClient(config: {
  clientId: string
  clientSecret: string
  redirectUri: string
  accessToken: string
  refreshToken?: string
}): GoogleCalendarClient {
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
  auth.setCredentials({ access_token: config.accessToken, refresh_token: config.refreshToken })
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
        const response = await calendar.events.list({ calendarId, timeMin, timeMax, singleEvents: true, orderBy: 'startTime', showDeleted: false })
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

export function makeCalendarReminderId(calendarId: string, eventId: string): string {
  return `google:${calendarId}:${eventId || randomUUID()}`
}
