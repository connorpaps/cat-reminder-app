import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'

const BACKUP_PATTERN = /^cat-reminder\.(?:\d{8}T\d{6}Z|\d{4}-\d{2}-\d{2}T\d{6}Z)\.sqlite$/

export function backupFileName(now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `cat-reminder.${stamp}.sqlite`
}

export function selectBackupFiles(files: string[], keepCount: number): { keep: string[]; remove: string[] } {
  const ordered = files.filter((file) => BACKUP_PATTERN.test(file)).sort().reverse()
  return { keep: ordered.slice(0, keepCount), remove: ordered.slice(keepCount) }
}

export function createDatabaseBackup(filePath: string, backupDirectory: string, now = new Date(), keepCount = 5): string | undefined {
  if (!existsSync(filePath)) return undefined
  mkdirSync(backupDirectory, { recursive: true })
  const backupPath = join(backupDirectory, backupFileName(now))
  copyFileSync(filePath, backupPath)
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${filePath}${suffix}`
    if (existsSync(sidecar)) copyFileSync(sidecar, `${backupPath}${suffix}`)
  }
  const retention = selectBackupFiles(readdirSync(backupDirectory), keepCount)
  for (const file of retention.remove) {
    unlinkSync(join(backupDirectory, file))
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = join(backupDirectory, `${file}${suffix}`)
      if (existsSync(sidecar)) unlinkSync(sidecar)
    }
  }
  return backupPath
}

export function backupDirectoryFor(filePath: string): string {
  return join(dirname(filePath), 'backups')
}
