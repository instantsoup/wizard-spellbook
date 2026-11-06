// Export / import everything as one JSON file.

import { db, type SpellbookDB } from './db'

export const BACKUP_APP = 'wizard-spellbook'
export const BACKUP_VERSION = 1

const TABLES = ['characters', 'knownSpells', 'days', 'templates', 'ledger', 'storedSpells', 'settings'] as const
type TableName = (typeof TABLES)[number]

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  data: Record<TableName, unknown[]>
}

export async function exportBackup(d: SpellbookDB = db): Promise<Backup> {
  const data = {} as Record<TableName, unknown[]>
  await d.transaction('r', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) data[t] = await d.table(t).toArray()
  })
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

export function parseBackup(text: string): Backup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const b = parsed as Partial<Backup>
  if (b?.app !== BACKUP_APP || typeof b.version !== 'number' || typeof b.data !== 'object' || !b.data) {
    throw new Error('This is not a Wizard’s Spellbook backup file.')
  }
  if (b.version > BACKUP_VERSION) throw new Error('This backup was made by a newer version of the app. Update first.')
  for (const t of TABLES) {
    const rows = (b.data as Record<string, unknown>)[t]
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Backup section "${t}" is damaged.`)
  }
  return b as Backup
}

/** Replaces ALL data on this device with the backup. */
export async function restoreBackup(backup: Backup, d: SpellbookDB = db) {
  await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) {
      await d.table(t).clear()
      const rows = backup.data[t] ?? []
      if (rows.length) await d.table(t).bulkAdd(rows)
    }
  })
}

export function backupFileName(date = new Date()) {
  return `spellbook-backup-${date.toISOString().slice(0, 10)}.json`
}

/** Triggers a download of the backup in the browser. */
export async function downloadBackup() {
  const backup = await exportBackup()
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName()
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  await db.settings.put({ key: 'lastBackupAt', value: Date.now() })
}
