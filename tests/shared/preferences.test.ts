import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES } from '../../src/shared/types/preferences'
import { isPreferencesPatch } from '../../src/shared/validation/runtime'

describe('user preferences', () => {
  it('defaults to automatic sync and respecting fullscreen applications', () => {
    expect(DEFAULT_PREFERENCES.syncEnabled).toBe(false)
    expect(DEFAULT_PREFERENCES.fullscreenPolicy).toBe('respect')
  })

  it('accepts explicit sync and fullscreen preference changes', () => {
    expect(isPreferencesPatch({ syncEnabled: true, fullscreenPolicy: 'show' })).toBe(true)
    expect(isPreferencesPatch({ syncEnabled: 'yes' })).toBe(false)
  })
})
