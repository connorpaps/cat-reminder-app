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
})
