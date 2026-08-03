import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OAuthTokens } from '../sync/google/oauth'

const providerFileNames: Record<string, string> = {
  google: 'google-calendar.tokens',
  ticktick: 'ticktick.tokens'
}

export type TokenProvider = keyof typeof providerFileNames

export class SecureTokenStore {
  private filePath(provider: TokenProvider): string {
    return join(app.getPath('userData'), providerFileNames[provider])
  }

  load(provider: TokenProvider = 'google'): OAuthTokens | null {
    const path = this.filePath(provider)
    if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return null
    try {
      return JSON.parse(safeStorage.decryptString(readFileSync(path))) as OAuthTokens
    } catch {
      return null
    }
  }

  save(tokens: OAuthTokens, provider: TokenProvider = 'google'): void {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure local storage is unavailable on this device.')
    writeFileSync(this.filePath(provider), safeStorage.encryptString(JSON.stringify(tokens)), { mode: 0o600 })
  }

  clear(provider: TokenProvider = 'google'): void {
    const path = this.filePath(provider)
    if (existsSync(path)) unlinkSync(path)
  }
}
