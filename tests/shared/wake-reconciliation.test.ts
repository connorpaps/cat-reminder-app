import { describe, expect, it } from 'vitest'
import { selectRecentWakeReminders } from '../../src/shared/reminders/wake-reconciliation'
import type { Reminder } from '../../src/shared/types/reminder'

const reminder = (id: string, startAt: string): Reminder => ({
  id, kind: 'timed', title: id, startAt, timezone: 'UTC', priority: 'normal', status: 'upcoming', enabled: true,
  source: 'manual', createdAt: startAt, updatedAt: startAt
})

describe('wake reconciliation', () => {
  it('selects at most one reminder missed within ten minutes of wake', () => {
    const wake = new Date('2026-08-03T10:00:00.000Z')
    const reminders = [
      reminder('recent', '2026-08-03T09:57:00.000Z'),
      reminder('older', '2026-08-03T09:40:00.000Z'),
      reminder('future', '2026-08-03T10:04:00.000Z')
    ]
    expect(selectRecentWakeReminders(reminders, wake, 10).map((item) => item.id)).toEqual(['recent'])
  })

  it('does not select future reminders or completed/dismissed reminders', () => {
    const wake = new Date('2026-08-03T10:00:00.000Z')
    const completed = { ...reminder('completed', '2026-08-03T09:59:00.000Z'), status: 'completed' as const }
    const dismissed = { ...reminder('dismissed', '2026-08-03T09:58:00.000Z'), status: 'dismissed' as const }
    expect(selectRecentWakeReminders([completed, dismissed, reminder('future', '2026-08-03T10:01:00.000Z')], wake, 10)).toEqual([])
  })
})
