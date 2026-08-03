import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { ANYTIME_SENTINEL_START, type CreateReminderInput, type Reminder, type UpdateReminderInput } from '../../shared/types/reminder'

export type ReminderRow = {
  id: string; kind: Reminder['kind']; title: string; description: string | null; start_at: string; end_at: string | null
  timezone: string; repeat_rule: string | null; priority: Reminder['priority']; status: Reminder['status']; enabled: number
  source: Reminder['source']; source_event_id: string | null; source_calendar_id: string | null
  snooze_until: string | null; series_id: string | null; occurrence_key: string | null
  created_at: string; updated_at: string
}

function fromRow(row: ReminderRow): Reminder {
  return {
    id: row.id, kind: row.kind, title: row.title, description: row.description ?? undefined, startAt: row.start_at,
    endAt: row.end_at ?? undefined, timezone: row.timezone,
    repeatRule: row.repeat_rule ? JSON.parse(row.repeat_rule) : undefined, priority: row.priority,
    status: row.status, enabled: row.enabled === 1, source: row.source, sourceEventId: row.source_event_id ?? undefined,
    sourceCalendarId: row.source_calendar_id ?? undefined, snoozeUntil: row.snooze_until ?? undefined,
    seriesId: row.series_id ?? undefined, occurrenceKey: row.occurrence_key ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at
  }
}

function toValues(reminder: Reminder): unknown[] {    return [reminder.id, reminder.kind, reminder.title, reminder.description ?? null, reminder.startAt, reminder.endAt ?? null,
    reminder.timezone, reminder.repeatRule ? JSON.stringify(reminder.repeatRule) : null, reminder.priority,
    reminder.status, reminder.enabled ? 1 : 0, reminder.source, reminder.sourceEventId ?? null, reminder.sourceCalendarId ?? null,
    reminder.snoozeUntil ?? null, reminder.seriesId ?? null, reminder.occurrenceKey ?? null,
    reminder.createdAt, reminder.updatedAt]
}

function sameLocalDate(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
}

export class ReminderRepository {
  constructor(private readonly db: Database.Database) {}

  list(): Reminder[] {
    return (this.db.prepare('SELECT * FROM reminders ORDER BY start_at ASC').all() as ReminderRow[]).map(fromRow)
  }

  get(id: string): Reminder | null {
    const row = this.db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as ReminderRow | undefined
    return row ? fromRow(row) : null
  }

  create(input: CreateReminderInput): Reminder {
    const now = new Date().toISOString()
    const id = randomUUID()
    const kind = input.kind ?? 'timed'
    const reminder: Reminder = {
      ...input, id, kind,
      // `anytime` tasks have no date; store the sentinel placeholder so start_at stays non-null.
      startAt: kind === 'anytime' ? ANYTIME_SENTINEL_START : (input.startAt ?? ANYTIME_SENTINEL_START),
      enabled: input.enabled ?? true, status: 'upcoming', source: 'manual',
      seriesId: input.repeatRule ? id : undefined, occurrenceKey: input.repeatRule ? (input.startAt ?? now) : undefined,
      createdAt: now, updatedAt: now
    }
    this.insert(reminder)
    return reminder
  }

  createNextOccurrence(previous: Reminder, startAt: string): Reminder {
    const seriesId = previous.seriesId ?? previous.id
    const existing = this.db.prepare('SELECT * FROM reminders WHERE series_id = ? AND occurrence_key = ?').get(seriesId, startAt) as ReminderRow | undefined
    if (existing) return fromRow(existing)
    const now = new Date().toISOString()
    const reminder: Reminder = {
      ...previous, id: randomUUID(), startAt, enabled: previous.enabled, status: 'upcoming', snoozeUntil: undefined,
      seriesId, occurrenceKey: startAt, createdAt: now, updatedAt: now
    }
    this.insert(reminder)
    return reminder
  }

  markTriggered(id: string, at = new Date()): void {
    this.db.prepare(`INSERT INTO reminder_trigger_state (reminder_id, last_triggered_at) VALUES (?, ?)
      ON CONFLICT(reminder_id) DO UPDATE SET last_triggered_at=excluded.last_triggered_at`).run(id, at.toISOString())
  }

  wasTriggeredWithin(id: string, windowMs: number, now = new Date()): boolean {
    const row = this.db.prepare('SELECT last_triggered_at FROM reminder_trigger_state WHERE reminder_id = ?').get(id) as { last_triggered_at: string } | undefined
    return Boolean(row && now.getTime() - new Date(row.last_triggered_at).getTime() < windowMs)
  }

  clearTriggered(id: string): void {
    this.db.prepare('DELETE FROM reminder_trigger_state WHERE reminder_id = ?').run(id)
  }

  upsertImported(reminder: Reminder): Reminder {
    this.insert(reminder, true)
    return this.get(reminder.id) ?? reminder
  }

  update(id: string, input: UpdateReminderInput): Reminder | null {
    const current = this.get(id)
    if (!current) return null
    const updated: Reminder = { ...current, ...input, enabled: input.enabled ?? current.enabled, updatedAt: new Date().toISOString() }
    const seriesId = updated.repeatRule ? (current.seriesId ?? current.id) : undefined
    const occurrenceKey = updated.repeatRule ? updated.startAt : undefined
    if (seriesId && occurrenceKey && (seriesId !== current.seriesId || occurrenceKey !== current.occurrenceKey)) {
      const collision = this.db.prepare('SELECT id FROM reminders WHERE series_id = ? AND occurrence_key = ? AND id <> ?').get(seriesId, occurrenceKey, id) as { id: string } | undefined
      if (collision) throw new Error('Another occurrence already exists at that time.')
    }
    const persisted: Reminder = { ...updated, seriesId, occurrenceKey }
    this.db.prepare(`UPDATE reminders SET title=?,description=?,start_at=?,end_at=?,timezone=?,repeat_rule=?,priority=?,status=?,enabled=?,snooze_until=?,series_id=?,occurrence_key=?,updated_at=? WHERE id=?`)
      .run(persisted.title, persisted.description ?? null, persisted.startAt, persisted.endAt ?? null, persisted.timezone,
        persisted.repeatRule ? JSON.stringify(persisted.repeatRule) : null, persisted.priority, persisted.status, persisted.enabled ? 1 : 0,
        persisted.snoozeUntil ?? null, persisted.seriesId ?? null, persisted.occurrenceKey ?? null, persisted.updatedAt, id)
    return persisted
  }

  remove(id: string): boolean {
    return this.db.prepare('DELETE FROM reminders WHERE id = ?').run(id).changes > 0
  }

  dueCandidates(now: Date, leadMinutes: number): Reminder[] {
    const upper = new Date(now.getTime() + leadMinutes * 60_000).toISOString()
    return (this.db.prepare(`SELECT * FROM reminders WHERE enabled = 1 AND kind = 'timed' AND status NOT IN ('completed','dismissed') AND start_at <= ? AND (snooze_until IS NULL OR snooze_until <= ?) ORDER BY start_at ASC`).all(upper, now.toISOString()) as ReminderRow[]).map(fromRow)
  }

  /** Time-less tasks for the daily roll-up: uncompleted `anytime` items plus `all-day` items due on the given day. */
  todayTasks(now = new Date()): Reminder[] {
    const rows = this.db.prepare(`SELECT * FROM reminders WHERE kind IN ('all-day','anytime') AND enabled = 1 AND status NOT IN ('completed','dismissed') ORDER BY start_at ASC`).all() as ReminderRow[]
    return rows.map(fromRow).filter((reminder) => reminder.kind === 'anytime' || sameLocalDate(new Date(reminder.startAt), now))
  }

  private insert(reminder: Reminder, upsert = false): void {
    const values = toValues(reminder)
    if (!upsert) {
    this.db.prepare(`INSERT INTO reminders
      (id,kind,title,description,start_at,end_at,timezone,repeat_rule,priority,status,enabled,source,source_event_id,source_calendar_id,snooze_until,series_id,occurrence_key,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...values)
      return
    }
    this.db.prepare(`INSERT INTO reminders
      (id,kind,title,description,start_at,end_at,timezone,repeat_rule,priority,status,enabled,source,source_event_id,source_calendar_id,snooze_until,series_id,occurrence_key,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(source, source_event_id) DO UPDATE SET
        title=excluded.title,
        description=excluded.description,
        kind=excluded.kind,
        start_at=excluded.start_at,
        end_at=excluded.end_at,
        timezone=excluded.timezone,
        updated_at=excluded.updated_at`).run(...values)
  }
}
