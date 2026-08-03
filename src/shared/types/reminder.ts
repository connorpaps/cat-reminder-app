export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent'

export type ReminderKind = 'timed' | 'all-day' | 'anytime'

// `anytime` tasks have no date at all; start_at is not nullable in the schema, so
// these rows use this sentinel as a stable placeholder that sorts to the top.
// Only `kind` drives behavior (the scheduler only ever considers `timed` rows).
export const ANYTIME_SENTINEL_START = '1970-01-01T00:00:00.000Z'

export type ReminderStatus =
  | 'upcoming'
  | 'soon'
  | 'due'
  | 'overdue'
  | 'snoozed'
  | 'completed'
  | 'dismissed'

export type ReminderSource = 'manual' | 'google-calendar' | 'google-tasks' | 'imported'

export type RecurrenceRule =
  | { frequency: 'daily'; interval?: number }
  | { frequency: 'weekly'; interval?: number; daysOfWeek?: number[] }
  | { frequency: 'monthly'; interval?: number; dayOfMonth?: number }

export type Reminder = {
  id: string
  kind: ReminderKind
  title: string
  description?: string
  startAt: string
  endAt?: string
  timezone: string
  repeatRule?: RecurrenceRule
  priority: ReminderPriority
  status: ReminderStatus
  enabled: boolean
  source: ReminderSource
  sourceEventId?: string
  sourceCalendarId?: string
  snoozeUntil?: string
  seriesId?: string
  occurrenceKey?: string
  createdAt: string
  updatedAt: string
}

export type CreateReminderInput = {
  title: string
  description?: string
  /** Required for `timed`/`all-day`; ignored (sentinel stored) for `anytime`. */
  startAt?: string
  endAt?: string
  timezone: string
  repeatRule?: RecurrenceRule
  priority: ReminderPriority
  /** Defaults to 'timed'. Only `timed` reminders support recurrence. */
  kind?: ReminderKind
  enabled?: boolean
}

export type UpdateReminderInput = Omit<Partial<CreateReminderInput>, 'kind'> & {
  status?: ReminderStatus
  snoozeUntil?: string
}
