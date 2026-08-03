import { describe, expect, it } from 'vitest'
import { dayKey, rollupDecision } from '../../src/main/scheduler/task-rollup'
import type { DailyRollupState } from '../../src/main/storage/task-rollup-repository'

describe('daily task roll-up', () => {
  it('formats local calendar day keys', () => {
    expect(dayKey(new Date(2026, 7, 2, 13, 30))).toBe('2026-08-02')
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  const nineAm = (day = 2) => new Date(2026, 7, day, 9, 0, 0, 0)
  const eightAm = (day = 2) => new Date(2026, 7, day, 8, 0, 0, 0)

  it('skips before the configured time and when there are no tasks', () => {
    expect(rollupDecision(eightAm(), '09:00', undefined, true)).toBe('skip')
    expect(rollupDecision(nineAm(), '09:00', undefined, false)).toBe('skip')
    expect(rollupDecision(nineAm(), '09:00', undefined, true)).toBe('show')
  })

  it('respects dismiss, shown, and snooze state', () => {
    const dismissed: DailyRollupState = { date: '2026-08-02', status: 'dismissed' }
    const shown: DailyRollupState = { date: '2026-08-02', status: 'shown' }
    const snoozing: DailyRollupState = { date: '2026-08-02', status: 'snoozed', snoozeUntil: new Date(nineAm(2).getTime() + 60_000).toISOString() }
    const expired: DailyRollupState = { date: '2026-08-02', status: 'snoozed', snoozeUntil: eightAm(2).toISOString() }

    expect(rollupDecision(nineAm(), '09:00', dismissed, true)).toBe('skip')
    expect(rollupDecision(nineAm(), '09:00', shown, true)).toBe('skip')
    expect(rollupDecision(nineAm(), '09:00', snoozing, true)).toBe('skip')
    expect(rollupDecision(nineAm(), '09:00', expired, true)).toBe('show')
  })

  it('ignores malformed reminder times', () => {
    expect(rollupDecision(nineAm(), 'not-a-time', undefined, true)).toBe('skip')
  })
})
