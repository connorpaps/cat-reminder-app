import type Database from 'better-sqlite3'
import { addMinutes } from 'date-fns'

export type SnoozeHistoryRecord = {
  reminderId: string
  occurrenceKey?: string
  snoozedAt: string
  snoozeUntil: string
  durationMinutes: number
}

export type DailyTaskSnoozeHistoryRecord = {
  date: string
  snoozedAt: string
  snoozeUntil: string
  durationMinutes: number
}

export function snoozeHistoryRecord(reminderId: string, occurrenceKey: string | undefined, snoozedAt: Date, durationMinutes: number): SnoozeHistoryRecord {
  return {
    reminderId,
    occurrenceKey,
    snoozedAt: snoozedAt.toISOString(),
    snoozeUntil: addMinutes(snoozedAt, durationMinutes).toISOString(),
    durationMinutes
  }
}

export class SnoozeHistoryRepository {
  constructor(private readonly db: Database.Database) {}

  record(reminderId: string, occurrenceKey: string | undefined, snoozedAt: Date, durationMinutes: number): SnoozeHistoryRecord {
    const record = snoozeHistoryRecord(reminderId, occurrenceKey, snoozedAt, durationMinutes)
    this.db.prepare(`INSERT INTO snooze_history (reminder_id, occurrence_key, snoozed_at, snooze_until, duration_minutes)
      VALUES (?, ?, ?, ?, ?)`).run(record.reminderId, record.occurrenceKey ?? null, record.snoozedAt, record.snoozeUntil, record.durationMinutes)
    return record
  }

  recordDailyTask(date: string, snoozedAt: Date, durationMinutes: number): DailyTaskSnoozeHistoryRecord {
    const record = {
      date,
      snoozedAt: snoozedAt.toISOString(),
      snoozeUntil: addMinutes(snoozedAt, durationMinutes).toISOString(),
      durationMinutes
    }
    this.db.prepare(`INSERT INTO daily_task_snooze_history (date, snoozed_at, snooze_until, duration_minutes)
      VALUES (?, ?, ?, ?)`).run(record.date, record.snoozedAt, record.snoozeUntil, record.durationMinutes)
    return record
  }

  list(reminderId: string): SnoozeHistoryRecord[] {
    return (this.db.prepare(`SELECT reminder_id, occurrence_key, snoozed_at, snooze_until, duration_minutes
      FROM snooze_history WHERE reminder_id = ? ORDER BY snoozed_at ASC`).all(reminderId) as Array<{
      reminder_id: string; occurrence_key: string | null; snoozed_at: string; snooze_until: string; duration_minutes: number
    }>).map((row) => ({
      reminderId: row.reminder_id,
      occurrenceKey: row.occurrence_key ?? undefined,
      snoozedAt: row.snoozed_at,
      snoozeUntil: row.snooze_until,
      durationMinutes: row.duration_minutes
    }))
  }
}
