import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OAuthTokens } from '../sync/google/oauth'

const fileName = 'google-calendar.tokens'

export class SecureTokenStore {
  private filePath(): string { return join(app.getPath('userData'), fileName) }

  load(): OAuthTokens | null {
    const path = this.filePath()
    if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return null
    try {
      return JSON.parse(safeStorage.decryptString(readFileSync(path))) as OAuthTokens
    } catch {
      return null
    }
  }

  save(tokens: OAuthTokens): void {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure local storage is unavailable on this device.')
    writeFileSync(this.filePath(), safeStorage.encryptString(JSON.stringify(tokens)), { mode: 0o600 })
  }

  clear(): void {
    const path = this.filePath()
    if (existsSync(path)) unlinkSync(path)
  }
}
