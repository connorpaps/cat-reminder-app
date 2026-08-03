import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        start_at TEXT NOT NULL,
        end_at TEXT,
        timezone TEXT NOT NULL,
        repeat_rule TEXT,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        source_event_id TEXT,
        source_calendar_id TEXT,
        snooze_until TEXT,
        series_id TEXT,
        occurrence_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source, source_event_id)
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_start_status ON reminders(start_at, status);
      CREATE INDEX IF NOT EXISTS idx_reminders_series_occurrence ON reminders(series_id, occurrence_key);
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_metadata (
        provider TEXT PRIMARY KEY,
        last_success_at TEXT,
        cursor TEXT
      );
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    sql: `
      DELETE FROM reminders AS duplicate
      WHERE duplicate.series_id IS NOT NULL
        AND duplicate.occurrence_key IS NOT NULL
        AND duplicate.rowid <> (
          SELECT candidate.rowid
          FROM reminders AS candidate
          WHERE candidate.series_id = duplicate.series_id
            AND candidate.occurrence_key = duplicate.occurrence_key
          ORDER BY candidate.updated_at DESC, candidate.rowid ASC
          LIMIT 1
        );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_series_occurrence_unique
        ON reminders(series_id, occurrence_key)
        WHERE series_id IS NOT NULL AND occurrence_key IS NOT NULL;
      CREATE TABLE IF NOT EXISTS reminder_trigger_state (
        reminder_id TEXT PRIMARY KEY,
        last_triggered_at TEXT NOT NULL,
        FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
      );
    `
  },
  {
    version: 3,
    sql: `ALTER TABLE reminders ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;`
  },
  {
    version: 4,
    sql: `
      ALTER TABLE reminders ADD COLUMN kind TEXT NOT NULL DEFAULT 'timed';
      CREATE TABLE IF NOT EXISTS daily_task_reminder_state (
        date TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        snooze_until TEXT
      );
    `
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS snooze_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reminder_id TEXT NOT NULL,
        occurrence_key TEXT,
        snoozed_at TEXT NOT NULL,
        snooze_until TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_snooze_history_reminder ON snooze_history(reminder_id, snoozed_at);
    `
  },
  {
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS daily_task_snooze_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        snoozed_at TEXT NOT NULL,
        snooze_until TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_daily_task_snooze_history_date
        ON daily_task_snooze_history(date, snoozed_at);
    `
  }
]

/** Apply every missing migration to an already-open SQLite database. */
export function applyMigrations(db: Database.Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => (row as { version: number }).version)
  )
  const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue
    const alreadyHasEnabled = migration.version === 3
      && (db.prepare('PRAGMA table_info(reminders)').all() as Array<{ name: string }>).some((column) => column.name === 'enabled')
    const apply = db.transaction(() => {
      if (!alreadyHasEnabled) db.exec(migration.sql)
      insert.run(migration.version, new Date().toISOString())
    })
    apply()
  }
}

export function createDatabase(filePath = join(app.getPath('userData'), 'cat-reminder.sqlite')): Database.Database {
  mkdirSync(dirname(filePath), { recursive: true })
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  return db
}

export const migrationVersions = migrations.map((migration) => migration.version)
