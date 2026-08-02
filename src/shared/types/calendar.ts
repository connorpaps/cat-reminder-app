export type CalendarInfo = {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
}

export type CalendarEvent = {
  id: string
  calendarId: string
  title: string
  description?: string
  startAt: string
  endAt?: string
  timezone: string
  status?: string
  htmlLink?: string
}

export type SyncResult = {
  imported: number
  updated: number
  skipped: number
  syncedAt: string
}
