import { describe, expect, it } from 'vitest'
import { formatSyncError } from '../../src/shared/sync-errors'

describe('sync error formatting', () => {
  it('uses the project number from the disabled API error', () => {
    const message = formatSyncError(new Error('Google Tasks API has not been used in project 999999999999 before or it is disabled.'))
    expect(message).toContain('Google Tasks API is disabled')
    expect(message).toContain('https://console.developers.google.com/apis/api/tasks.googleapis.com/overview?project=999999999999')
  })

  it('does not mislabel unrelated Tasks URLs as a disabled API', () => {
    expect(formatSyncError(new Error('Request failed at https://tasks.googleapis.com/custom'))).toBe('Request failed at https://tasks.googleapis.com/custom')
  })

  it('explains how to refresh outdated Google permissions', () => {
    expect(formatSyncError(new Error('Request had insufficient authentication scopes.'))).toBe(
      'Google permissions are outdated. Disconnect and reconnect Google to grant Calendar + Tasks access.'
    )
  })
})
