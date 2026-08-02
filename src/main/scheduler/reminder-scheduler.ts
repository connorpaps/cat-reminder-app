import type { Reminder } from '../../shared/types/reminder'
import { statusAt } from '../../shared/reminders/state'
import { ReminderRepository } from '../storage/reminder-repository'
import { TriggerQueue } from './trigger-queue'

export type SchedulerListener = (reminder: Reminder) => void

export class ReminderScheduler {
  private timer: NodeJS.Timeout | undefined
  private readonly queue = new TriggerQueue()
  private listener: SchedulerListener | undefined
  private deferred = false

  constructor(private readonly repository: ReminderRepository, private readonly leadMinutes: () => number) {}

  onTrigger(listener: SchedulerListener): void { this.listener = listener }

  start(intervalMs = 30_000): void {
    this.stop()
    this.reconcile()
    this.timer = setInterval(() => this.reconcile(), intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  reconcile(now = new Date()): void {
    for (const reminder of this.repository.dueCandidates(now, this.leadMinutes())) {
      if (!reminder.enabled) continue
      const due = statusAt(reminder, now, this.leadMinutes()) === 'due' || statusAt(reminder, now, this.leadMinutes()) === 'overdue'
      if (due && !this.repository.wasTriggeredWithin(reminder.id, 30 * 60_000, now)) {
        if (this.queue.enqueue(reminder)) this.repository.markTriggered(reminder.id, now)
      }
    }
    if (!this.deferred) this.emitNext()
  }

  completeActive(): void {
    const next = this.queue.finish()
    if (next) this.listener?.(next)
  }

  deferActive(): void {
    this.queue.deferActive()
    this.deferred = true
  }

  retryDeferred(): void {
    this.deferred = false
    this.emitNext()
  }
  pendingCount(): number { return this.queue.size() }

  private emitNext(): void {
    const next = this.queue.beginNext()
    if (next) this.listener?.(next)
  }
}
