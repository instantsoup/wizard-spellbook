// Spells known (Eidetic Spellcasting): starting spells, free level-up picks,
// learned spells and what they cost.

import type { Spell } from '../data/spell-schema'
import { alignmentBar, alignmentNotes } from './alignment'
import { casterLevel, castingScoreName, isProhibited, meetsCastingMinimum } from './character'
import { maxSpellLevel, minIntForSpellLevel } from './tables'
import { check, FREE_METHODS, type AcquisitionMethod, type KnownSpell, type RuleCheck, type WizardCharacter } from './types'

/**
 * Free picks granted at each caster level: 3 + Int mod (at 1st) at level 1, then 2 per level.
 * Prestige class levels that add wizard spellcasting count too (the "as if you had also gained a
 * level in an arcane spellcasting class" wording), so this runs to caster level, not wizard level.
 */
export function freePicksGranted(c: WizardCharacter): Map<number, number> {
  const granted = new Map<number, number>()
  granted.set(1, Math.max(0, 3 + c.intModAtLevel1))
  for (let lvl = 2; lvl <= casterLevel(c); lvl++) granted.set(lvl, 2)
  return granted
}

export interface FreePickStatus {
  wizardLevel: number
  granted: number
  used: number
  remaining: number
  /** Highest spell level a pick from this caster level may take. */
  maxSpellLevel: number
}

/** Free picks per granting level, counting starting-free and levelup-free spells. */
export function freePickStatus(c: WizardCharacter, known: KnownSpell[]): FreePickStatus[] {
  const used = new Map<number, number>()
  for (const k of known) {
    if ((k.method === 'starting-free' || k.method === 'levelup-free') && k.freePickLevel) {
      used.set(k.freePickLevel, (used.get(k.freePickLevel) ?? 0) + 1)
    }
  }
  return [...freePicksGranted(c)].map(([wizardLevel, granted]) => {
    const u = used.get(wizardLevel) ?? 0
    return {
      wizardLevel,
      granted,
      used: u,
      remaining: Math.max(0, granted - u),
      // Starting picks must be 1st level; level-up picks any level castable at that level.
      maxSpellLevel: wizardLevel === 1 ? 1 : maxSpellLevel(wizardLevel),
    }
  })
}

export function totalFreePicksRemaining(c: WizardCharacter, known: KnownSpell[]): number {
  return freePickStatus(c, known).reduce((sum, s) => sum + s.remaining, 0)
}

/** 100 gp per spell level (cantrips count as 1st). */
export const GP_PER_SPELL_LEVEL = 100

/** Pages a spell takes in a spellbook: one per spell level, one for a cantrip (PH p. 179). */
export const pagesFor = (spellLevel: number) => Math.max(1, spellLevel)

/** Pages in a standard spellbook, and in a Boccob's blessed book (DMG). */
export const BOOK_PAGES = 100
export const BOCCOBS_PAGES = 1000

/**
 * Gold cost to write a spell into a book. Free methods cost nothing; copying from your own
 * book costs half (PH p. 179); a Boccob's blessed book needs no costly inks (DMG).
 */
export function learnCost(spellLevel: number, method: AcquisitionMethod, opts: { boccobs?: boolean } = {}): number {
  if (FREE_METHODS.includes(method) || opts.boccobs) return 0
  const full = GP_PER_SPELL_LEVEL * pagesFor(spellLevel)
  return method === 'copy' ? full / 2 : full
}

/**
 * Market price of an arcane scroll of a spell, at the lowest caster level that can cast it
 * (DMG: 25 gp x spell level x caster level; a 0-level spell counts as 1/2).
 */
export function scrollPrice(spellLevel: number): number {
  if (spellLevel <= 0) return 12.5
  return 25 * spellLevel * Math.max(1, spellLevel * 2 - 1)
}

/** Everything this book entry cost: scribing plus the scroll, if it came from one. */
export function entryCost(k: KnownSpell): number {
  return k.costGp + (k.scrollCostGp ?? 0)
}

export function totalSpent(known: KnownSpell[]): number {
  return known.reduce((sum, k) => sum + entryCost(k), 0)
}

/**
 * Cantrips a new wizard starts with: "all 0-level wizard spells" (PH p. 57) except prohibited
 * schools. That covers every book in the spell list, not only the Player's Handbook.
 */
export function startingCantrips(c: WizardCharacter, spells: Spell[]): Spell[] {
  return spells.filter((s) => s.level === 0 && !isProhibited(c, s.school))
}

export interface LearnRequest {
  method: AcquisitionMethod
  /** Required for free picks: which caster level's pick this uses. */
  freePickLevel?: number
  /** The spellbook to write it in. Entries without a book count as the starting book. */
  bookId?: string
}

/** Can this spell be added to the book this way? */
export function canLearn(c: WizardCharacter, spell: Spell, known: KnownSpell[], req: LearnRequest): RuleCheck {
  const errors: string[] = []
  const warnings: string[] = []

  const inThisBook = (k: KnownSpell) => req.bookId === undefined || k.bookId === undefined || k.bookId === req.bookId
  if (known.some((k) => k.spellId === spell.id && inThisBook(k))) errors.push(`${spell.name} is already in this book.`)
  if (isProhibited(c, spell.school)) errors.push(`${spell.school} is a prohibited school.`)
  const barred = alignmentBar(c, spell)
  if (barred) errors.push(barred)
  warnings.push(...alignmentNotes(c, spell))

  const castable = maxSpellLevel(casterLevel(c))
  switch (req.method) {
    case 'starting-cantrip':
      if (spell.level !== 0) errors.push('Only 0-level spells can be starting cantrips.')
      break
    case 'starting-free':
    case 'levelup-free': {
      const lvl = req.method === 'starting-free' ? 1 : req.freePickLevel
      if (!lvl) {
        errors.push('Choose which level-up this free spell comes from.')
        break
      }
      if (req.method === 'levelup-free' && lvl < 2) errors.push('Level-up picks start at level 2.')
      const status = freePickStatus(c, known).find((s) => s.wizardLevel === lvl)
      if (!status) {
        errors.push(`You haven't reached caster level ${lvl}.`)
        break
      }
      if (status.remaining <= 0) errors.push(`No free picks left from level ${lvl}.`)
      if (lvl === 1 && spell.level !== 1) errors.push('Starting free spells must be 1st level.')
      else if (spell.level > status.maxSpellLevel) {
        errors.push(`A free pick from level ${lvl} can be at most spell level ${status.maxSpellLevel}.`)
      }
      if (spell.level === 0) warnings.push('Cantrips are already in your book for free.')
      break
    }
    case 'copy':
      if (!known.some((k) => k.spellId === spell.id && !inThisBook(k))) errors.push(`${spell.name} isn't in another of your books to copy from.`)
      break
    default:
      if (spell.level > castable) errors.push(`${spell.name} is level ${spell.level}; you can only learn spells up to level ${castable}.`)
  }

  if (!meetsCastingMinimum(c, spell.level)) {
    warnings.push(`You need ${castingScoreName(c)} ${minIntForSpellLevel(spell.level)} to prepare this spell.`)
  }
  return check(errors, warnings)
}

/** Builds the book entry for a successful learn, with the default cost filled in. */
export function makeKnownSpell(
  spell: Spell,
  req: LearnRequest,
  extra?: { note?: string; scrollCostGp?: number; boccobs?: boolean },
): KnownSpell {
  const freePickLevel = req.method === 'starting-free' ? 1 : req.method === 'levelup-free' ? req.freePickLevel : undefined
  return {
    spellId: spell.id,
    spellLevel: spell.level,
    method: req.method,
    ...(freePickLevel ? { freePickLevel } : {}),
    ...(req.bookId ? { bookId: req.bookId } : {}),
    costGp: learnCost(spell.level, req.method, { boccobs: extra?.boccobs }),
    ...(req.method === 'scroll' && extra?.scrollCostGp !== undefined ? { scrollCostGp: Math.max(0, extra.scrollCostGp) } : {}),
    ...(extra?.note ? { note: extra.note } : {}),
  }
}
