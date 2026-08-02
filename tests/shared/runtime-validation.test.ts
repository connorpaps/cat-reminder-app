import { describe, expect, it } from 'vitest'
import { isCreateReminderInput, isPreferencesPatch, isReminderAction } from '../../src/shared/validation/runtime'

describe('runtime validation', () => {
  it('rejects malformed reminder and action values', () => {
    expect(isCreateReminderInput({ title: null, startAt: 'bad' })).toBe(false)
    expect(isCreateReminderInput({ title: 'Reminder', startAt: '2026-01-01T10:00:00Z', timezone: 'Not/AZone', priority: 'normal' })).toBe(false)
    expect(isCreateReminderInput({ title: 'Reminder', startAt: '2026-01-01T10:00:00Z', timezone: 'UTC', priority: 'normal', enabled: 'yes' })).toBe(false)
    expect(isReminderAction('delete-all')).toBe(false)
  })

  it('accepts constrained preference patches', () => {
    expect(isPreferencesPatch({ reminderLeadTimeMinutes: 10, openInTray: false })).toBe(true)
    expect(isPreferencesPatch({ reminderLeadTimeMinutes: -1 })).toBe(false)
  })
})
