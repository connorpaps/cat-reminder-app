import { addMinutes } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { nextOccurrence, occurrenceKey } from '../../src/shared/reminders/recurrence'
import { complete, dismiss, snooze, statusAt } from '../../src/shared/reminders/state'
import type { Reminder } from '../../src/shared/types/reminder'

const base: Reminder = {
  id: 'r1', kind: 'timed', title: 'Review', startAt: '2026-01-10T10:00:00.000Z', timezone: 'UTC',
  priority: 'normal', status: 'upcoming', enabled: true, source: 'manual', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('reminder rules', () => {
  it('classifies a reminder as due inside the configured lead time', () => {
    const now = new Date('2026-01-10T09:56:00.000Z')
    expect(statusAt(base, now, 5)).toBe('due')
    expect(statusAt(base, new Date('2026-01-10T09:00:00.000Z'), 5)).toBe('soon')
  })

  it('never reports time-less tasks as due or overdue', () => {
    const anytime: Reminder = { ...base, kind: 'anytime', startAt: '1970-01-01T00:00:00.000Z' }
    const allDay: Reminder = { ...base, kind: 'all-day', startAt: '2026-01-10T00:00:00.000Z' }
    expect(statusAt(anytime, new Date('2026-01-10T09:56:00.000Z'), 5)).toBe('upcoming')
    expect(statusAt(allDay, new Date('2026-01-10T09:56:00.000Z'), 5)).toBe('upcoming')
  })

  it('snoozes until the requested future time', () => {
    const now = new Date('2026-01-10T09:56:00.000Z')
    expect(snooze(base, 10, now).snoozeUntil).toBe(addMinutes(now, 10).toISOString())
  })

  it('completes and dismisses only the current occurrence', () => {
    expect(complete(base).status).toBe('completed')
    expect(dismiss(base).status).toBe('dismissed')
  })

  it('calculates daily and weekly occurrences', () => {
    expect(nextOccurrence(base.startAt, { frequency: 'daily' }, 'UTC', new Date('2026-01-10T10:00:00.000Z'))).toBe('2026-01-11T10:00:00.000Z')
    expect(nextOccurrence(base.startAt, { frequency: 'weekly', daysOfWeek: [6] }, 'UTC', new Date('2026-01-10T10:00:00.000Z'))).toBe('2026-01-17T10:00:00.000Z')
    expect(nextOccurrence(base.startAt, { frequency: 'weekly', daysOfWeek: [6] }, 'UTC', new Date('2026-01-10T09:00:00.000Z'))).toBe('2026-01-10T10:00:00.000Z')
  })

  it('uses stable occurrence keys', () => {
    expect(occurrenceKey(base.startAt)).toBe(base.startAt)
  })
})
