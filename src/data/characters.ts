// Character and spellbook actions. UI calls these; they call the rules engine.

import type { Spell } from './spell-schema'
import { BOCCOBS_PAGES, BOOK_PAGES, canLearn, makeKnownSpell, startingCantrips, type LearnRequest, type WizardCharacter } from '../rules'
import { db, newId, STARTING_BOOK_NAME, type BookRecord, type CharacterRecord, type KnownSpellRecord, type SpellbookDB } from './db'

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
  await d.transaction('rw', d.characters, d.settings, d.books, async () => {
    await d.characters.add(record)
    await d.books.add({ id: newId(), characterId: record.id, name: STARTING_BOOK_NAME, createdAt: now })
    await setActiveCharacter(record.id, d)
  })
  return record
}

/** A character's books, oldest (the starting book) first. */
export async function booksFor(characterId: string, d: SpellbookDB = db): Promise<BookRecord[]> {
  return (await d.books.where('characterId').equals(characterId).toArray()).sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name))
}

/**
 * Makes sure the character has a book and every entry is in one. Repairs data restored from
 * an older backup, made before characters had several books.
 */
export async function ensureBooks(characterId: string, d: SpellbookDB = db): Promise<BookRecord[]> {
  return d.transaction('rw', d.books, d.knownSpells, async () => {
    let books = await booksFor(characterId, d)
    if (!books.length) {
      await d.books.add({ id: newId(), characterId, name: STARTING_BOOK_NAME, createdAt: Date.now() })
      books = await booksFor(characterId, d)
    }
    const first = books[0].id
    const ids = new Set(books.map((b) => b.id))
    await d.knownSpells
      .where('characterId')
      .equals(characterId)
      .filter((k) => !k.bookId || !ids.has(k.bookId))
      .modify({ bookId: first })
    return books
  })
}

/** Adds a spellbook. Names must differ so books can be told apart. */
export async function addBook(characterId: string, name: string, boccobs: boolean, d: SpellbookDB = db): Promise<{ ok: boolean; error?: string; book?: BookRecord }> {
  const clean = name.trim()
  if (!clean) return { ok: false, error: 'Give the book a name.' }
  const books = await booksFor(characterId, d)
  if (books.some((b) => b.name.toLowerCase() === clean.toLowerCase())) return { ok: false, error: `You already have a book called "${clean}".` }
  const book: BookRecord = { id: newId(), characterId, name: clean, ...(boccobs ? { boccobs: true } : {}), createdAt: Date.now() }
  await d.books.add(book)
  return { ok: true, book }
}

/** Renames a book or changes whether it is a Boccob's blessed book (costs already paid stay). */
export async function updateBook(id: string, changes: { name?: string; boccobs?: boolean }, d: SpellbookDB = db): Promise<{ ok: boolean; error?: string }> {
  const book = await d.books.get(id)
  if (!book) return { ok: false, error: 'That book no longer exists.' }
  const patch: Partial<BookRecord> = {}
  if (changes.name !== undefined) {
    const clean = changes.name.trim()
    if (!clean) return { ok: false, error: 'Give the book a name.' }
    const others = (await booksFor(book.characterId, d)).filter((b) => b.id !== id)
    if (others.some((b) => b.name.toLowerCase() === clean.toLowerCase())) return { ok: false, error: `You already have a book called "${clean}".` }
    patch.name = clean
  }
  if (changes.boccobs !== undefined) patch.boccobs = changes.boccobs
  await d.books.update(id, patch)
  return { ok: true }
}

/** Deletes a book and the spells written in it. The last book can't be deleted. */
export async function deleteBook(id: string, d: SpellbookDB = db): Promise<{ ok: boolean; error?: string }> {
  const book = await d.books.get(id)
  if (!book) return { ok: true }
  if ((await booksFor(book.characterId, d)).length <= 1) return { ok: false, error: 'You need at least one spellbook.' }
  await d.transaction('rw', d.books, d.knownSpells, async () => {
    await d.knownSpells.where('bookId').equals(id).delete()
    await d.books.delete(id)
  })
  return { ok: true }
}

export async function updateCharacter(id: string, changes: Partial<CharacterInput>, d: SpellbookDB = db) {
  await d.characters.update(id, { ...changes, updatedAt: Date.now() })
}

/** Deletes a character and everything that belongs to it. */
export async function deleteCharacter(id: string, d: SpellbookDB = db) {
  await d.transaction('rw', [d.characters, d.knownSpells, d.days, d.templates, d.ledger, d.settings, d.books], async () => {
    await d.characters.delete(id)
    await d.knownSpells.where('characterId').equals(id).delete()
    await d.books.where('characterId').equals(id).delete()
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
  items: { spell: Spell; req: LearnRequest; note?: string; scrollCostGp?: number }[],
  d: SpellbookDB = db,
): Promise<{ ok: boolean; errors: string[]; added: KnownSpellRecord[] }> {
  return d.transaction('rw', d.knownSpells, d.books, async () => {
    // Spells go into the starting book unless a book is named.
    const books = await ensureBooks(character.id, d)
    const known = await knownSpellsFor(character.id, d)
    const errors: string[] = []
    const added: KnownSpellRecord[] = []
    for (const item of items) {
      const book = books.find((b) => b.id === item.req.bookId) ?? books[0]
      const req = { ...item.req, bookId: book.id, bookPages: book.boccobs ? BOCCOBS_PAGES : BOOK_PAGES }
      const result = canLearn(character, item.spell, [...known, ...added], req)
      if (!result.ok) {
        errors.push(...result.errors.map((e) => `${item.spell.name}: ${e}`))
        continue
      }
      added.push({
        ...makeKnownSpell(item.spell, req, { ...item, boccobs: book.boccobs }),
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
  const result = await learnSpells(character, missing.map((spell) => ({ spell, req: { method: 'starting-cantrip' as const } })), d)
  if (result.ok) await d.characters.update(character.id, { cantripsOffered: spells.filter((s) => s.level === 0).map((s) => s.id) })
  return result
}

/** Cantrips this character has already been given, including for records saved before the list existed. */
function offeredCantrips(character: CharacterRecord, spells: Spell[]): Set<string> {
  if (character.cantripsOffered) return new Set(character.cantripsOffered)
  // The older flag meant every cantrip then in the app, which was all but Kan'Derra's.
  if (character.allCantrips) return new Set(spells.filter((s) => s.level === 0 && s.source !== "Kan'Derra Player's Edition").map((s) => s.id))
  return new Set()
}

/**
 * Adds cantrips this character hasn't been given yet: ones from books added since the
 * character was made. Cantrips the player removed are not added back.
 */
export async function addNewCantrips(character: CharacterRecord, spells: Spell[], d: SpellbookDB = db) {
  const offered = offeredCantrips(character, spells)
  const cantrips = spells.filter((s) => s.level === 0)
  if (character.cantripsOffered && cantrips.every((s) => offered.has(s.id))) return { ok: true, errors: [], added: [] }
  const known = new Set((await knownSpellsFor(character.id, d)).map((k) => k.spellId))
  const fresh = startingCantrips(character, spells).filter((s) => !offered.has(s.id) && !known.has(s.id))
  const result = await learnSpells(character, fresh.map((spell) => ({ spell, req: { method: 'starting-cantrip' as const } })), d)
  if (result.ok) await d.characters.update(character.id, { cantripsOffered: [...new Set([...offered, ...cantrips.map((s) => s.id)])] })
  return result
}

export async function forgetSpell(knownSpellId: string, d: SpellbookDB = db) {
  await d.knownSpells.delete(knownSpellId)
}

/**
 * Change a book entry's note and, for a spell copied from a scroll, what the scroll cost.
 * The scribing cost is fixed by the rules.
 */
export async function updateKnownSpell(id: string, changes: { note: string; scrollCostGp?: number }, d: SpellbookDB = db) {
  const patch: Partial<KnownSpellRecord> = { note: changes.note.trim() || undefined }
  if (changes.scrollCostGp !== undefined) patch.scrollCostGp = Math.max(0, changes.scrollCostGp)
  await d.knownSpells.update(id, patch)
}

/** Book entries whose spell is from one of the given schools. */
export async function knownSpellsInSchools(
  characterId: string,
  schools: readonly string[],
  spellsById: ReadonlyMap<string, Spell>,
  d: SpellbookDB = db,
): Promise<KnownSpellRecord[]> {
  if (!schools.length) return []
  const known = await knownSpellsFor(characterId, d)
  return known.filter((k) => {
    const s = spellsById.get(k.spellId)
    return s && schools.includes(s.school)
  })
}

/** Saves character changes; spells from newly prohibited schools leave the book. */
export async function updateCharacterAndBook(
  id: string,
  changes: Partial<CharacterInput>,
  removeKnownIds: string[],
  d: SpellbookDB = db,
) {
  await d.transaction('rw', d.characters, d.knownSpells, d.days, async () => {
    await updateCharacter(id, changes, d)
    if (!removeKnownIds.length) return
    const removed = new Set((await d.knownSpells.bulkGet(removeKnownIds)).filter(Boolean).map((k) => k!.spellId))
    await d.knownSpells.bulkDelete(removeKnownIds)
    // Empty any prepared slots that held those spells.
    await d.days
      .where('characterId')
      .equals(id)
      .modify((day) => {
        day.slots = day.slots.map((s) => (s.spellId && removed.has(s.spellId) ? { ...s, spellId: undefined, expended: false } : s))
      })
  })
}
