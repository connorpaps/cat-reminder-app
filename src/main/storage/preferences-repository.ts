import type Database from 'better-sqlite3'
import { DEFAULT_PREFERENCES, type Preferences } from '../../shared/types/preferences'

export class PreferencesRepository {
  constructor(private readonly db: Database.Database) {}

  get(): Preferences {
    const rows = this.db.prepare('SELECT key, value FROM preferences').all() as { key: string; value: string }[]
    const stored = Object.fromEntries(rows.map(({ key, value }) => [key, JSON.parse(value)]))
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
