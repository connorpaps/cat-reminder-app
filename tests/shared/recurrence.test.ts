import { describe, expect, it } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'
import { nextOccurrence } from '../../src/shared/reminders/recurrence'

describe('recurring occurrence generation', () => {
  it('advances daily and weekly rules strictly after the completed occurrence', () => {
    expect(nextOccurrence('2026-01-10T10:00:00.000Z', { frequency: 'daily' }, 'UTC', new Date('2026-01-10T10:00:00.000Z'))).toBe('2026-01-11T10:00:00.000Z')
    expect(nextOccurrence('2026-01-10T10:00:00.000Z', { frequency: 'weekly', daysOfWeek: [6] }, 'UTC', new Date('2026-01-10T10:00:00.000Z'))).toBe('2026-01-17T10:00:00.000Z')
  })

  it('chooses the closest future day when weekdays are out of source order', () => {
    expect(nextOccurrence('2026-01-07T10:00:00.000Z', { frequency: 'weekly', daysOfWeek: [2, 4] }, 'UTC', new Date('2026-01-07T10:00:00.000Z'))).toBe('2026-01-08T10:00:00.000Z')
  })

  it('keeps the daily wall-clock time across spring DST transition', () => {
    const next = nextOccurrence('2026-03-07T14:30:00.000Z', { frequency: 'daily' }, 'America/New_York', new Date('2026-03-07T14:30:00.000Z'))
    expect(formatInTimeZone(next!, 'America/New_York', "yyyy-MM-dd HH:mm XXX")).toBe('2026-03-08 09:30 -04:00')
  })

  it('keeps monthly wall-clock time across spring DST transition', () => {
    const next = nextOccurrence('2026-02-08T14:30:00.000Z', { frequency: 'monthly' }, 'America/New_York', new Date('2026-02-08T14:30:00.000Z'))
    expect(formatInTimeZone(next!, 'America/New_York', "yyyy-MM-dd HH:mm XXX")).toBe('2026-03-08 09:30 -04:00')
  })

  it('keeps weekly wall-clock time across fall DST transition', () => {
    const next = nextOccurrence('2026-10-25T13:15:00.000Z', { frequency: 'weekly' }, 'America/New_York', new Date('2026-10-25T13:15:00.000Z'))
    expect(formatInTimeZone(next!, 'America/New_York', "yyyy-MM-dd HH:mm XXX")).toBe('2026-11-01 09:15 -05:00')
    const following = nextOccurrence(next!, { frequency: 'weekly' }, 'America/New_York', new Date(next!))
    expect(formatInTimeZone(following!, 'America/New_York', "yyyy-MM-dd HH:mm XXX")).toBe('2026-11-08 09:15 -05:00')
  })

  it('returns null for an invalid timezone', () => {
    expect(nextOccurrence('2026-01-10T10:00:00.000Z', { frequency: 'daily' }, 'Not/AZone', new Date('2026-01-10T10:00:00.000Z'))).toBeNull()
  })
})
