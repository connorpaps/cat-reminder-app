import type { Reminder } from '../types/reminder'

/** Select at most one active reminder that was missed shortly before wake. */
export function selectRecentWakeReminders(reminders: Reminder[], wakeAt: Date, windowMinutes: number): Reminder[] {
  const wakeMs = wakeAt.getTime()
  const lowerBound = wakeMs - windowMinutes * 60_000
  return reminders
    .filter((reminder) => {
      const start = new Date(reminder.startAt).getTime()
      return reminder.enabled && reminder.kind === 'timed' && reminder.status !== 'completed' && reminder.status !== 'dismissed'
        && start >= lowerBound && start <= wakeMs && !Number.isNaN(start)
    })
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
    .slice(0, 1)
}
