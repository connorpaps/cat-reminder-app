import { describe, expect, it } from 'vitest'
import { calendarEventToReminder } from '../../src/main/sync/google/calendar-sync'

describe('calendar mapping', () => {
  it('preserves provider identifiers and does not create an editable source', () => {
    const reminder = calendarEventToReminder({ id: 'event-1', calendarId: 'calendar-1', title: 'Standup', startAt: '2026-01-01T10:00:00Z', timezone: 'UTC' }, new Date('2026-01-01T00:00:00Z'))
    expect(reminder.enabled).toBe(true)
    expect(reminder.source).toBe('google-calendar')
    expect(reminder.sourceEventId).toBe('event-1')
    expect(reminder.sourceCalendarId).toBe('calendar-1')
  })
})
