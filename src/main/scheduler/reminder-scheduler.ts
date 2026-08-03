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
  // A reminder missed while the computer was asleep is suppressed for that
  // occurrence, rather than merely being rate-limited for 30 minutes. This
  // prevents a backlog from reappearing later in the same app session.
  private readonly wakeSuppressedIds = new Set<string>()

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

  reconcile(now = new Date(), onlyReminderId?: string, suppressOlderMissed = false): void {
    for (const reminder of this.repository.dueCandidates(now, this.leadMinutes())) {
      if (!reminder.enabled || this.wakeSuppressedIds.has(reminder.id)) continue
      const status = statusAt(reminder, now, this.leadMinutes())
      const due = status === 'due' || status === 'overdue'
      if (!due || this.repository.wasTriggeredWithin(reminder.id, 30 * 60_000, now)) continue
      const isMissed = new Date(reminder.startAt).getTime() <= now.getTime()
      if (suppressOlderMissed && isMissed && (!onlyReminderId || reminder.id !== onlyReminderId)) {
        this.repository.markTriggered(reminder.id, now)
        this.wakeSuppressedIds.add(reminder.id)
        continue
      }
      if (onlyReminderId && reminder.id !== onlyReminderId) continue
      if (this.queue.enqueue(reminder)) this.repository.markTriggered(reminder.id, now)
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
  /** True when no reminder is queued or actively showing, so the task roll-up can safely take the overlay. */
  isIdle(): boolean { return this.queue.size() === 0 && !this.queue.isActive() }

  private emitNext(): void {
    const next = this.queue.beginNext()
    if (next) this.listener?.(next)
  }
}
