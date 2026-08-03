import type Database from 'better-sqlite3'

export type SyncMetadata = {
  selectedCalendarIds: string[]
  selectedTaskListIds: string[]
  selectedTicktickProjectIds: string[]
  lastSuccessAt?: string
}

type CursorPayload = {
  selectedCalendarIds?: unknown
  selectedTaskListIds?: unknown
  selectedTicktickProjectIds?: unknown
}

export class SyncRepository {
  constructor(private readonly db: Database.Database) {}

  get(provider = 'google-calendar'): SyncMetadata {
    const row = this.db.prepare('SELECT last_success_at, cursor FROM sync_metadata WHERE provider = ?').get(provider) as { last_success_at: string | null; cursor: string | null } | undefined
    if (!row) return { selectedCalendarIds: [], selectedTaskListIds: [], selectedTicktickProjectIds: [] }
    let selectedCalendarIds: string[] = []
    let selectedTaskListIds: string[] = []
    let selectedTicktickProjectIds: string[] = []
    try {
      const parsed: CursorPayload = row.cursor ? JSON.parse(row.cursor) : {}
      if (Array.isArray(parsed.selectedCalendarIds)) selectedCalendarIds = parsed.selectedCalendarIds.filter((id): id is string => typeof id === 'string')
      if (Array.isArray(parsed.selectedTaskListIds)) selectedTaskListIds = parsed.selectedTaskListIds.filter((id): id is string => typeof id === 'string')
      if (Array.isArray(parsed.selectedTicktickProjectIds)) selectedTicktickProjectIds = parsed.selectedTicktickProjectIds.filter((id): id is string => typeof id === 'string')
    } catch {
      /* keep empty defaults */
    }
    return { selectedCalendarIds, selectedTaskListIds, selectedTicktickProjectIds, lastSuccessAt: row.last_success_at ?? undefined }
  }

  save(metadata: SyncMetadata, provider = 'google-calendar'): void {
    const cursor: CursorPayload = {
      selectedCalendarIds: metadata.selectedCalendarIds,
      selectedTaskListIds: metadata.selectedTaskListIds,
      selectedTicktickProjectIds: metadata.selectedTicktickProjectIds
    }
    this.db.prepare(`INSERT INTO sync_metadata (provider, last_success_at, cursor) VALUES (?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET last_success_at=excluded.last_success_at, cursor=excluded.cursor`)
      .run(provider, metadata.lastSuccessAt ?? null, JSON.stringify(cursor))
  }

  clear(provider = 'google-calendar'): void {
    this.db.prepare('DELETE FROM sync_metadata WHERE provider = ?').run(provider)
  }
}
