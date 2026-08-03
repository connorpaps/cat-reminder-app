import type Database from 'better-sqlite3'
import { DEFAULT_PREFERENCES, type Preferences } from '../../shared/types/preferences'

export class PreferencesRepository {
  constructor(private readonly db: Database.Database) {}

  get(): Preferences {
    const rows = this.db.prepare('SELECT key, value FROM preferences').all() as { key: string; value: string }[]
    // A corrupt stored value must not crash boot; fall back to the default.
    const stored = Object.fromEntries(
      rows
        .map(({ key, value }) => { try { return [key, JSON.parse(value)] as const } catch { return null } })
        .filter((entry): entry is readonly [string, unknown] => entry !== null)
    )
    return { ...DEFAULT_PREFERENCES, ...stored }
  }

  update(input: Partial<Preferences>): Preferences {
    const next = { ...this.get(), ...input }
    const statement = this.db.prepare('INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    const save = this.db.transaction(() => {
      for (const [key, value] of Object.entries(next)) statement.run(key, JSON.stringify(value))
    })
    save()
    return next
  }
}
