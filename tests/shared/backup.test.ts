import { describe, expect, it } from 'vitest'
import { backupFileName, selectBackupFiles } from '../../src/main/storage/backup'

describe('database backup retention', () => {
  it('keeps the newest five backups and identifies older backups for removal', () => {
    const files = [
      'cat-reminder.2026-08-01T000000Z.sqlite',
      'cat-reminder.2026-08-02T000000Z.sqlite',
      'cat-reminder.2026-08-03T000000Z.sqlite',
      'cat-reminder.2026-08-04T000000Z.sqlite',
      'cat-reminder.2026-08-05T000000Z.sqlite',
      'cat-reminder.2026-08-06T000000Z.sqlite'
    ]
    expect(selectBackupFiles(files, 5)).toEqual({
      keep: files.slice(1).reverse(),
      remove: [files[0]]
    })
  })

  it('generates names that the retention matcher recognizes', () => {
    const file = backupFileName(new Date('2026-08-03T01:23:04.567Z'))
    expect(file).toBe('cat-reminder.20260803T012304Z.sqlite')
    expect(selectBackupFiles([file], 5).keep).toEqual([file])
  })
})
