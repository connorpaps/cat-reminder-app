import type { Reminder } from '../../shared/types/reminder'

export class TriggerQueue {
  private readonly pending: Reminder[] = []
  private readonly knownIds = new Set<string>()
  private active: Reminder | null = null

  enqueue(reminder: Reminder): boolean {
    if (this.knownIds.has(reminder.id)) return false
    this.knownIds.add(reminder.id)
    this.pending.push(reminder)
    return true
  }

  beginNext(): Reminder | null {
    if (this.active) return null
    this.active = this.pending.shift() ?? null
    return this.active
  }

  finish(): Reminder | null {
    if (this.active) this.knownIds.delete(this.active.id)
    this.active = null
    return this.beginNext()
  }

  deferActive(): void {
    if (!this.active) return
    this.pending.unshift(this.active)
    this.active = null
  }

  isActive(): boolean { return this.active !== null }
  activeId(): string | null { return this.active?.id ?? null }
  size(): number { return this.pending.length }
}
