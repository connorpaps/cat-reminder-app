import { addMinutes, isAfter } from 'date-fns'
import type { Reminder, ReminderStatus } from '../types/reminder'

export function statusAt(reminder: Reminder, now = new Date(), leadMinutes = 5): ReminderStatus {
  if (reminder.status === 'completed' || reminder.status === 'dismissed') return reminder.status
  if (reminder.snoozeUntil && isAfter(new Date(reminder.snoozeUntil), now)) return 'snoozed'
  // Time-less tasks never enter the timed due/overdue pipeline; they surface via the daily roll-up.
  if (reminder.kind !== 'timed') return 'upcoming'
  const start = new Date(reminder.startAt)
  const diff = start.getTime() - now.getTime()
  if (diff < 0) return 'overdue'
  if (diff <= leadMinutes * 60_000) return 'due'
  if (diff <= 60 * 60_000) return 'soon'
  return 'upcoming'
}

export function snooze(reminder: Reminder, minutes: number, now = new Date()): Reminder {
  return { ...reminder, status: 'snoozed', snoozeUntil: addMinutes(now, minutes).toISOString(), updatedAt: now.toISOString() }
}

export function dismiss(reminder: Reminder, now = new Date()): Reminder {
  return { ...reminder, status: 'dismissed', snoozeUntil: undefined, updatedAt: now.toISOString() }
}
