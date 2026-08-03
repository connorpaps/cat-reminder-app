import type Database from 'better-sqlite3'

export type DailyRollupStatus = 'pending' | 'shown' | 'snoozed' | 'dismissed'

export type DailyRollupState = {
  date: string
  status: DailyRollupStatus
  snoozeUntil?: string
}

/**
 * Per-day state for the daily task roll-up (the cat showing the day's time-less
 * tasks at the configured time). A missing row means 'pending' for that day.
 */
export class DailyTaskRollupRepository {
  constructor(private readonly db: Database.Database) {}

  get(date: string): DailyRollupState | undefined {
    const row = this.db.prepare('SELECT date, status, snooze_until FROM daily_task_reminder_state WHERE date = ?').get(date) as
      | { date: string; status: DailyRollupStatus; snooze_until: string | null }
      | undefined
    if (!row) return undefined
    return { date: row.date, status: row.status, snoozeUntil: row.snooze_until ?? undefined }
  }

  markShown(date: string): void {
    this.save(date, 'shown', null)
  }

  markSnoozed(date: string, snoozeUntil: string): void {
    this.save(date, 'snoozed', snoozeUntil)
  }

  markDismissed(date: string): void {
    this.save(date, 'dismissed', null)
  }

  private save(date: string, status: DailyRollupStatus, snoozeUntil: string | null): void {
    this.db.prepare(`INSERT INTO daily_task_reminder_state (date, status, snooze_until) VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET status=excluded.status, snooze_until=excluded.snooze_until`).run(date, status, snoozeUntil)
  }
}
