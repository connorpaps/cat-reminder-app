export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent'

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

export type CreateReminderInput = Pick<
  Reminder,
  'title' | 'description' | 'startAt' | 'endAt' | 'timezone' | 'repeatRule' | 'priority'
> & {
  enabled?: boolean
}

export type UpdateReminderInput = Partial<CreateReminderInput> & {
  status?: ReminderStatus
  snoozeUntil?: string
}
