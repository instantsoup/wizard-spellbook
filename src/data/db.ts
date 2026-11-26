// On-device storage (IndexedDB via Dexie). All tables are declared now so later
// phases don't need a schema migration.

import Dexie, { type EntityTable } from 'dexie'
import { migrateCharacter } from './migrate'
import type { KnownSpell, PreparedSlot, WizardCharacter } from '../rules'
import type { SpellRecord } from './spell-schema'

export interface CharacterRecord extends WizardCharacter {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /**
   * Ids of the 0-level spells already given to this character as starting cantrips. A cantrip
   * that appears later (a new book) is added once; one the player removed is not added back.
   */
  cantripsOffered?: string[]
  /** Older flag: every cantrip except Kan'Derra's had been added. Read only, for upgrades. */
  allCantrips?: boolean
}

export interface KnownSpellRecord extends KnownSpell {
  id: string
  characterId: string
  addedAt: number
}

/** One of a character's spellbooks. Every character has at least one. */
export interface BookRecord {
  id: string
  characterId: string
  /** "Starting spellbook" for the first; the player names the rest. */
  name: string
  /** A Boccob's blessed book: 1000 pages, and writing spells in it costs nothing (DMG). */
  boccobs?: boolean
  createdAt: number
}

export const STARTING_BOOK_NAME = 'Starting spellbook'

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
export interface StoredSpellRecord extends SpellRecord {
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
  books!: EntityTable<BookRecord, 'id'>

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
    // v4: custom casting stores a score for spells per day instead of a modifier.
    this.version(4)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('characters')
          .toCollection()
          .modify((c: Record<string, unknown>, ref: { value: unknown }) => {
            ref.value = migrateCharacter(c)
          }),
      )
    // v5: characters can have several spellbooks. Each gets a starting book holding the
    // spells it already knows.
    this.version(5)
      .stores({ books: 'id, characterId', knownSpells: 'id, characterId, spellId, bookId, [characterId+spellId]' })
      .upgrade(async (tx) => {
        for (const c of await tx.table('characters').toArray()) {
          const bookId = newId()
          await tx.table('books').add({ id: bookId, characterId: c.id, name: STARTING_BOOK_NAME, createdAt: c.createdAt ?? Date.now() })
          await tx
            .table('knownSpells')
            .where('characterId')
            .equals(c.id)
            .modify((k: Record<string, unknown>) => {
              k.bookId = bookId
            })
        }
      })
  }
}

export const newId = () => crypto.randomUUID()

export const db = new SpellbookDB()

/** Ask the browser not to clear our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
