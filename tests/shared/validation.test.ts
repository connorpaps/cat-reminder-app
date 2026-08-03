import { describe, expect, it } from 'vitest'
import { validateReminderInput } from '../../src/shared/validation/reminder'

describe('reminder validation', () => {
  it('rejects an empty title and invalid time', () => {
    expect(validateReminderInput({ title: ' ', startAt: 'nope', timezone: 'UTC', priority: 'normal' })).toEqual([
      'A title is required.', 'Choose a valid start time.'
    ])
  })

  it('rejects an end before the start', () => {
    expect(validateReminderInput({ title: 'Meeting', startAt: '2026-01-01T10:00:00Z', endAt: '2026-01-01T09:00:00Z', timezone: 'UTC', priority: 'normal' })).toContain('End time must be after the start time.')
  })

  it('accepts time-less tasks without a start time', () => {
    expect(validateReminderInput({ title: 'Water plants', timezone: 'UTC', priority: 'normal', kind: 'anytime' })).toEqual([])
    expect(validateReminderInput({ title: 'Ship day', startAt: '2026-01-01T00:00:00Z', timezone: 'UTC', priority: 'normal', kind: 'all-day' })).toEqual([])
  })

  it('requires a start time for timed reminders and rejects recurrence on time-less tasks', () => {
    expect(validateReminderInput({ title: 'Standup', timezone: 'UTC', priority: 'normal', kind: 'timed' })).toContain('Choose a valid start time.')
    expect(validateReminderInput({ title: 'Water plants', timezone: 'UTC', priority: 'normal', kind: 'anytime', repeatRule: { frequency: 'daily' } })).toContain('Recurrence is only supported for timed reminders.')
  })
})
