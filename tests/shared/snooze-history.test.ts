import { describe, expect, it } from 'vitest'
import { snoozeHistoryRecord } from '../../src/main/storage/snooze-history'

describe('snooze history', () => {
  it('creates an ISO-8601 record for a snoozed occurrence', () => {
    expect(snoozeHistoryRecord('r1', 'occ-1', new Date('2026-08-03T10:00:00.000Z'), 10)).toEqual({
      reminderId: 'r1', occurrenceKey: 'occ-1', snoozedAt: '2026-08-03T10:00:00.000Z',
      snoozeUntil: '2026-08-03T10:10:00.000Z', durationMinutes: 10
    })
  })
})
