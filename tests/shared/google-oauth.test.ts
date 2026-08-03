import { describe, expect, it } from 'vitest'
import { mergeGoogleTokens } from '../../src/main/sync/google/oauth'

describe('Google OAuth token persistence', () => {
  it('preserves the existing refresh token when a refresh response omits it', () => {
    expect(mergeGoogleTokens(
      { accessToken: 'old-access', refreshToken: 'stable-refresh', expiryDate: 1 },
      { accessToken: 'new-access', expiryDate: 2 }
    )).toEqual({ accessToken: 'new-access', refreshToken: 'stable-refresh', expiryDate: 2 })
  })

  it('uses a rotated refresh token when Google returns one', () => {
    expect(mergeGoogleTokens(
      { accessToken: 'old-access', refreshToken: 'old-refresh' },
      { accessToken: 'new-access', refreshToken: 'new-refresh' }
    ).refreshToken).toBe('new-refresh')
  })
})
