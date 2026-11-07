// On-device storage (IndexedDB via Dexie). All tables are declared now so later
// phases don't need a schema migration.

import Dexie, { type EntityTable } from 'dexie'
import type { KnownSpell, PreparedSlot, WizardCharacter } from '../rules'
import type { Spell } from './spell-schema'

export interface CharacterRecord extends WizardCharacter {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface KnownSpellRecord extends KnownSpell {
  id: string
  characterId: string
  addedAt: number
}

export interface PreparedDayRecord {
  id: string
  characterId: string
  label?: string
  startedAt: number
  /** 1 = the character's current day (number so it can be indexed). */
  current: 0 | 1
  slots: PreparedSlot[]
}

export interface PrepTemplateRecord {
  id: string
  characterId: string
  name: string
  picks: Pick<PreparedSlot, 'slotLevel' | 'kind' | 'spellId'>[]
}

export interface LedgerRecord {
  id: string
  characterId: string
  amountGp: number
  label: string
  at: number
}

/** Spells imported from a JSON file or entered with the custom spell form. */
export interface StoredSpellRecord extends Spell {
  origin: 'imported' | 'custom'
}

export interface SettingRecord {
  key: string
  value: unknown
}

export class SpellbookDB extends Dexie {
  characters!: EntityTable<CharacterRecord, 'id'>
  knownSpells!: EntityTable<KnownSpellRecord, 'id'>
  days!: EntityTable<PreparedDayRecord, 'id'>
  templates!: EntityTable<PrepTemplateRecord, 'id'>
  ledger!: EntityTable<LedgerRecord, 'id'>
  storedSpells!: EntityTable<StoredSpellRecord, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>

  constructor(name = 'wizard-spellbook') {
    super(name)
    this.version(1).stores({
      characters: 'id, name',
      knownSpells: 'id, characterId, spellId, [characterId+spellId]',
      days: 'id, characterId, [characterId+current]',
      templates: 'id, characterId',
      ledger: 'id, characterId',
      storedSpells: 'id, origin',
      settings: 'key',
    })
    // v2: table-rule settings were removed; strip them from saved wizards.
    this.version(2)
      .stores({})
      .upgrade((tx) =>
      tx
        .table('characters')
        .toCollection()
        .modify((c: Record<string, unknown>) => {
          delete c.houseRules
        }),
    )
    // v3: the app tracks only spellbook costs; drop extra costs and manual expenses.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('ledger').clear()
        await tx
          .table('knownSpells')
          .toCollection()
          .modify((k: Record<string, unknown>) => {
            delete k.extraCostGp
          })
      })
  }
}

export const db = new SpellbookDB()

export const newId = () => crypto.randomUUID()

/** Ask the browser not to clear our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
