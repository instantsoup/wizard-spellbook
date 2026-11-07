// Character and spellbook actions. UI calls these; they call the rules engine.

import type { Spell } from './spell-schema'
import { canLearn, makeKnownSpell, startingCantrips, type LearnRequest, type WizardCharacter } from '../rules'
import { db, newId, type CharacterRecord, type KnownSpellRecord, type SpellbookDB } from './db'

export const ACTIVE_CHARACTER_KEY = 'activeCharacterId'

export async function getActiveCharacterId(d: SpellbookDB = db): Promise<string | undefined> {
  return (await d.settings.get(ACTIVE_CHARACTER_KEY))?.value as string | undefined
}

export async function setActiveCharacter(id: string | undefined, d: SpellbookDB = db) {
  if (id) await d.settings.put({ key: ACTIVE_CHARACTER_KEY, value: id })
  else await d.settings.delete(ACTIVE_CHARACTER_KEY)
}

export type CharacterInput = WizardCharacter & { name: string }

export async function createCharacter(input: CharacterInput, d: SpellbookDB = db): Promise<CharacterRecord> {
  const now = Date.now()
  const record: CharacterRecord = { ...input, id: newId(), createdAt: now, updatedAt: now }
  await d.transaction('rw', d.characters, d.settings, async () => {
    await d.characters.add(record)
    await setActiveCharacter(record.id, d)
  })
  return record
}

export async function updateCharacter(id: string, changes: Partial<CharacterInput>, d: SpellbookDB = db) {
  await d.characters.update(id, { ...changes, updatedAt: Date.now() })
}

/** Deletes a character and everything that belongs to it. */
export async function deleteCharacter(id: string, d: SpellbookDB = db) {
  await d.transaction('rw', [d.characters, d.knownSpells, d.days, d.templates, d.ledger, d.settings], async () => {
    await d.characters.delete(id)
    await d.knownSpells.where('characterId').equals(id).delete()
    await d.days.where('characterId').equals(id).delete()
    await d.templates.where('characterId').equals(id).delete()
    await d.ledger.where('characterId').equals(id).delete()
    if ((await getActiveCharacterId(d)) === id) {
      const next = await d.characters.toCollection().first()
      await setActiveCharacter(next?.id, d)
    }
  })
}

export async function knownSpellsFor(characterId: string, d: SpellbookDB = db) {
  return d.knownSpells.where('characterId').equals(characterId).toArray()
}

/**
 * Adds spells to the book after checking each with the rules engine.
 * All-or-nothing: if any spell fails, nothing is added and the errors are returned.
 */
export async function learnSpells(
  character: CharacterRecord,
  items: { spell: Spell; req: LearnRequest; note?: string }[],
  d: SpellbookDB = db,
): Promise<{ ok: boolean; errors: string[]; added: KnownSpellRecord[] }> {
  return d.transaction('rw', d.knownSpells, async () => {
    const known = await knownSpellsFor(character.id, d)
    const errors: string[] = []
    const added: KnownSpellRecord[] = []
    for (const item of items) {
      const result = canLearn(character, item.spell, [...known, ...added], item.req)
      if (!result.ok) {
        errors.push(...result.errors.map((e) => `${item.spell.name}: ${e}`))
        continue
      }
      added.push({
        ...makeKnownSpell(item.spell, item.req, item),
        id: newId(),
        characterId: character.id,
        addedAt: Date.now(),
      })
    }
    if (errors.length) return { ok: false, errors, added: [] }
    await d.knownSpells.bulkAdd(added)
    return { ok: true, errors: [], added }
  })
}

/** Adds every non-prohibited cantrip not already in the book. */
export async function addStartingCantrips(character: CharacterRecord, spells: Spell[], d: SpellbookDB = db) {
  const known = new Set((await knownSpellsFor(character.id, d)).map((k) => k.spellId))
  const missing = startingCantrips(character, spells).filter((s) => !known.has(s.id))
  return learnSpells(character, missing.map((spell) => ({ spell, req: { method: 'starting-cantrip' as const } })), d)
}

export async function forgetSpell(knownSpellId: string, d: SpellbookDB = db) {
  await d.knownSpells.delete(knownSpellId)
}

/** Change a book entry's note (the cost is fixed by the rules). */
export async function updateKnownSpellNote(id: string, note: string, d: SpellbookDB = db) {
  await d.knownSpells.update(id, { note: note.trim() || undefined })
}
