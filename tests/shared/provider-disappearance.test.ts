import { describe, expect, it } from 'vitest'
import { shouldHideProviderReminder } from '../../src/shared/display-only'

describe('provider disappearance safeguards', () => {
  it('only hides an imported reminder when its provider scope was successfully synced and the source key was absent', () => {
    expect(shouldHideProviderReminder({ source: 'ticktick', sourceCalendarId: 'p1', sourceEventId: 't1' }, {
      provider: 'ticktick', syncedScopeIds: ['p1'], seenKeys: new Set(['p1:t2'])
    })).toBe(true)
  })

  it('does not hide reminders from deselected or failed scopes', () => {
    expect(shouldHideProviderReminder({ source: 'ticktick', sourceCalendarId: 'p2', sourceEventId: 't1' }, {
      provider: 'ticktick', syncedScopeIds: ['p1'], seenKeys: new Set()
    })).toBe(false)
  })
})
