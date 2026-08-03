import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { applyMigrations, migrationVersions } from '../../src/main/storage/database'

describe('database migrations', () => {
  it('keeps migrations versioned through snooze history', () => {
    expect(migrationVersions).toEqual([1, 2, 3, 4, 5, 6])
  })

  // better-sqlite3 is compiled for Electron's ABI in this repository. The
  // system Node 24 runner uses a different ABI, so execute this integration
  // test under Electron/Node 22 (ABI 135) rather than pretending it ran here.
  it.skipIf(process.versions.modules !== '135')('applies migrations idempotently and preserves an existing reminder row', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cat-reminder-migrations-'))
    const databasePath = join(directory, 'cat-reminder.sqlite')
    const db = new Database(databasePath)
    db.pragma('foreign_keys = ON')
    applyMigrations(db)
    db.prepare(`INSERT INTO reminders
      (id,kind,title,start_at,timezone,priority,status,enabled,source,created_at,updated_at)
      VALUES ('r1','timed','Keep me','2026-08-03T10:00:00.000Z','UTC','normal','upcoming',1,'manual','2026-08-03T00:00:00.000Z','2026-08-03T00:00:00.000Z')`).run()
    applyMigrations(db)
    expect(db.prepare('SELECT title FROM reminders WHERE id = ?').get('r1')).toEqual({ title: 'Keep me' })
    expect(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({ count: migrationVersions.length })
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'daily_task_snooze_history'").get()).toEqual({ name: 'daily_task_snooze_history' })
    db.close()
    expect(existsSync(databasePath)).toBe(true)
    rmSync(directory, { recursive: true, force: true })
  })
})
