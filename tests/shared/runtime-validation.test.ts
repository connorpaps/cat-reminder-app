import { describe, expect, it } from 'vitest'
import { isCreateReminderInput, isPreferencesPatch, isReminderAction, isUpdateReminderInput } from '../../src/shared/validation/runtime'

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
    expect(isPreferencesPatch({ dailyTaskReminderEnabled: true, dailyTaskReminderTime: '09:30' })).toBe(true)
    expect(isPreferencesPatch({ dailyTaskReminderTime: '25:00' })).toBe(false)
  })

  it('accepts time-less task inputs and rejects kind mutation on updates', () => {
    expect(isCreateReminderInput({ title: 'Water plants', timezone: 'UTC', priority: 'normal', kind: 'anytime' })).toBe(true)
    expect(isCreateReminderInput({ title: 'Ship day', startAt: '2026-01-01T00:00:00Z', timezone: 'UTC', priority: 'normal', kind: 'all-day' })).toBe(true)
    expect(isCreateReminderInput({ title: 'Standup', timezone: 'UTC', priority: 'normal', kind: 'timed' })).toBe(false)
    expect(isCreateReminderInput({ title: 'Bad', startAt: '2026-01-01T10:00:00Z', timezone: 'UTC', priority: 'normal', kind: 'flying' })).toBe(false)
    expect(isUpdateReminderInput({ kind: 'anytime' })).toBe(false)
  })
})
