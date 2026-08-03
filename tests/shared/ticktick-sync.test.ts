import { describe, expect, it } from 'vitest'
import { taskToReminder } from '../../src/main/sync/ticktick/ticktick-sync'
import type { TickTickTask } from '../../src/shared/types/ticktick'

const baseTask: TickTickTask = { id: 't1', projectId: 'proj1', title: 'Buy milk' }

describe('ticktick taskToReminder', () => {
  it('maps a timed task to a timed reminder keeping source ids', () => {
    const reminder = taskToReminder({ ...baseTask, dueDate: '2026-08-05T14:00:00+0200', timeZone: 'Europe/Paris', priority: 3 })
    expect(reminder.kind).toBe('timed')
    expect(reminder.startAt).toBe('2026-08-05T14:00:00+0200')
    expect(reminder.timezone).toBe('Europe/Paris')
    expect(reminder.source).toBe('ticktick')
    expect(reminder.sourceEventId).toBe('t1')
    expect(reminder.sourceCalendarId).toBe('proj1')
    expect(reminder.priority).toBe('normal')
  })

  it('maps a no-date task to anytime (daily roll-up input)', () => {
    const reminder = taskToReminder(baseTask)
    expect(reminder.kind).toBe('anytime')
    expect(reminder.startAt).toBe('1970-01-01T00:00:00.000Z')
    expect(reminder.enabled).toBe(true)
  })

  it('maps an all-day task to local midnight of its date', () => {
    const reminder = taskToReminder({ ...baseTask, isAllDay: true, dueDate: '2026-08-05' })
    expect(reminder.kind).toBe('all-day')
    const local = new Date(reminder.startAt)
    expect(local.getFullYear()).toBe(2026)
    expect(local.getMonth()).toBe(7)
    expect(local.getDate()).toBe(5)
    expect(local.getHours()).toBe(0)
  })

  it('maps a date-only dueDate to all-day even without the isAllDay flag', () => {
    const reminder = taskToReminder({ ...baseTask, dueDate: '2026-12-25' })
    expect(reminder.kind).toBe('all-day')
  })

  it('marks completed tasks as completed and disabled', () => {
    const reminder = taskToReminder({ ...baseTask, status: 2 })
    expect(reminder.status).toBe('completed')
    expect(reminder.enabled).toBe(false)
  })

  it('maps TickTick priorities 0/1/3/5 to our scale', () => {
    expect(taskToReminder({ ...baseTask, priority: 0 }).priority).toBe('normal')
    expect(taskToReminder({ ...baseTask, priority: 1 }).priority).toBe('low')
    expect(taskToReminder({ ...baseTask, priority: 3 }).priority).toBe('normal')
    expect(taskToReminder({ ...baseTask, priority: 5 }).priority).toBe('high')
  })

  it('carries the checklist description into the reminder description', () => {
    const reminder = taskToReminder({ ...baseTask, desc: 'Whole milk', content: 'notes' })
    expect(reminder.description).toBe('Whole milk')
  })
})
