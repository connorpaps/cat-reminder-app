import { describe, expect, it } from 'vitest'
import { TriggerQueue } from '../../src/main/scheduler/trigger-queue'
import type { Reminder } from '../../src/shared/types/reminder'

const reminder = (id: string): Reminder => ({ id, title: id, startAt: '2026-01-01T00:00:00Z', timezone: 'UTC', priority: 'normal', status: 'due', enabled: true, source: 'manual', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' })

describe('TriggerQueue', () => {
  it('shows one reminder and queues the rest in order without active duplicates', () => {
    const queue = new TriggerQueue()
    expect(queue.enqueue(reminder('one'))).toBe(true)
    expect(queue.beginNext()?.id).toBe('one')
    expect(queue.enqueue(reminder('one'))).toBe(false)
    expect(queue.enqueue(reminder('two'))).toBe(true)
    expect(queue.enqueue(reminder('two'))).toBe(false)
    expect(queue.finish()?.id).toBe('two')
    expect(queue.finish()).toBeNull()
  })

  it('can defer the active reminder without losing FIFO order', () => {
    const queue = new TriggerQueue()
    queue.enqueue(reminder('one'))
    queue.enqueue(reminder('two'))
    expect(queue.beginNext()?.id).toBe('one')
    queue.deferActive()
    expect(queue.beginNext()?.id).toBe('one')
    expect(queue.finish()?.id).toBe('two')
  })
})
