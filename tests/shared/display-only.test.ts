import { describe, expect, it } from 'vitest'
import { taskToReminder as googleTaskToReminder } from '../../src/main/sync/google/tasks-sync'
import { taskToReminder as tickTickTaskToReminder } from '../../src/main/sync/ticktick/ticktick-sync'

describe('display-only provider reminders', () => {
  it('hides externally completed Google Tasks without marking them completed locally', () => {
    expect(googleTaskToReminder({ id: 'g1', taskListId: 'l1', title: 'Done', status: 'completed' }).status).toBe('dismissed')
  })

  it('hides externally completed TickTick tasks without marking them completed locally', () => {
    expect(tickTickTaskToReminder({ id: 't1', projectId: 'p1', title: 'Done', status: 2 }).status).toBe('dismissed')
  })
})
