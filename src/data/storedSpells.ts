// Spells kept on the device: imported JSON files and the custom spell form.

import { db, type SpellbookDB, type StoredSpellRecord } from './db'
import { slugify, validateSpell, validateSpellFile, type Spell } from './spell-schema'

export interface ImportResult {
  ok: boolean
  added: number
  replaced: number
  errors: string[]
}

/** Validates a spell JSON file and stores its spells (all-or-nothing). */
export async function importSpellFile(text: string, d: SpellbookDB = db): Promise<ImportResult> {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, added: 0, replaced: 0, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }
  // Accept a single spell object as well as an array.
  if (data && !Array.isArray(data) && typeof data === 'object') data = [data]
  const errors = validateSpellFile(data)
  if (errors.length) return { ok: false, added: 0, replaced: 0, errors }
  const spells = data as Spell[]
  const existing = new Set((await d.storedSpells.bulkGet(spells.map((s) => s.id))).filter(Boolean).map((s) => s!.id))
  await d.storedSpells.bulkPut(spells.map((s) => ({ ...s, origin: 'imported' as const })))
  return { ok: true, added: spells.length - existing.size, replaced: existing.size, errors: [] }
}

/** Picks an id for a new custom spell that doesn't clash with any existing spell. */
export function uniqueSpellId(name: string, takenIds: ReadonlySet<string>): string {
  const base = slugify(name) || 'spell'
  if (!takenIds.has(base)) return base
  for (let i = 2; ; i++) if (!takenIds.has(`${base}-${i}`)) return `${base}-${i}`
}

export async function saveCustomSpell(spell: Spell, d: SpellbookDB = db): Promise<string[]> {
  const errors = validateSpell(spell)
  if (errors.length) return errors
  await d.storedSpells.put({ ...spell, origin: 'custom' })
  return []
}

export async function deleteStoredSpell(id: string, d: SpellbookDB = db) {
  await d.storedSpells.delete(id)
}

/** Stored spells as a spell file (same format as public/data/spells/*.json). */
export async function exportStoredSpells(d: SpellbookDB = db): Promise<Spell[]> {
  const rows: StoredSpellRecord[] = await d.storedSpells.toArray()
  return rows
    .map(({ origin: _o, ...s }) => s)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

export function downloadText(text: string, fileName: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJson(data: unknown, fileName: string) {
  downloadText(JSON.stringify(data, null, 2) + '\n', fileName, 'application/json')
}
