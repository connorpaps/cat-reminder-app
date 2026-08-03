import { describe, expect, it } from 'vitest'
import { ANYTIME_SENTINEL_START } from '../../src/shared/types/reminder'
import { taskToReminder } from '../../src/main/sync/google/tasks-sync'

const now = new Date('2026-01-01T00:00:00.000Z')

describe('google tasks mapping', () => {
  it('maps due-less tasks to anytime reminders (no date, sentinel start)', () => {
    const reminder = taskToReminder({ id: 't1', taskListId: 'list-1', title: 'Buy milk', status: 'needsAction' }, now)
    expect(reminder.kind).toBe('anytime')
    expect(reminder.startAt).toBe(ANYTIME_SENTINEL_START)
    expect(reminder.source).toBe('google-tasks')
    expect(reminder.sourceEventId).toBe('t1')
    expect(reminder.enabled).toBe(true)
  })

  it('maps a midnight-UTC due date to an all-day task on the local date', () => {
    const reminder = taskToReminder({ id: 't2', taskListId: 'list-1', title: 'Ship day', due: '2026-08-02T00:00:00.000Z', status: 'needsAction' }, now)
    expect(reminder.kind).toBe('all-day')
    const local = new Date(reminder.startAt)
    expect(local.getFullYear()).toBe(2026)
    expect(local.getMonth()).toBe(7) // August
    expect(local.getDate()).toBe(2)
  })

  it('maps dated tasks with a real time to timed reminders', () => {
    const reminder = taskToReminder({ id: 't3', taskListId: 'list-1', title: 'Call dentist', due: '2026-08-02T14:30:00.000Z', status: 'needsAction' }, now)
    expect(reminder.kind).toBe('timed')
    expect(reminder.startAt).toBe('2026-08-02T14:30:00.000Z')
  })

  it('marks completed tasks as disabled and completed', () => {
    const reminder = taskToReminder({ id: 't4', taskListId: 'list-1', title: 'Done', due: '2026-08-02T14:30:00.000Z', status: 'completed' }, now)
    expect(reminder.enabled).toBe(false)
    expect(reminder.status).toBe('completed')
  })
})
