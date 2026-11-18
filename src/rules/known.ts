// Spells known (Eidetic Spellcasting): starting spells, free level-up picks,
// learned spells and what they cost.

import type { Spell } from '../data/spell-schema'
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

/** Gold cost to learn a spell. Free methods cost nothing. */
export function learnCost(spellLevel: number, method: AcquisitionMethod): number {
  if (FREE_METHODS.includes(method)) return 0
  return GP_PER_SPELL_LEVEL * Math.max(1, spellLevel)
}

export function totalSpent(known: KnownSpell[]): number {
  return known.reduce((sum, k) => sum + k.costGp, 0)
}

/**
 * Cantrips a new wizard starts with: every core (SRD) 0-level spell not from a prohibited
 * school. Cantrips from other books are learned like any other spell.
 */
export function startingCantrips(c: WizardCharacter, spells: Spell[]): Spell[] {
  return spells.filter((s) => s.level === 0 && s.source === 'SRD' && !isProhibited(c, s.school))
}

export interface LearnRequest {
  method: AcquisitionMethod
  /** Required for free picks: which caster level's pick this uses. */
  freePickLevel?: number
}

/** Can this spell be added to the book this way? */
export function canLearn(c: WizardCharacter, spell: Spell, known: KnownSpell[], req: LearnRequest): RuleCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (known.some((k) => k.spellId === spell.id)) errors.push(`${spell.name} is already in your book.`)
  if (isProhibited(c, spell.school)) errors.push(`${spell.school} is a prohibited school.`)

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
  extra?: { note?: string },
): KnownSpell {
  const freePickLevel = req.method === 'starting-free' ? 1 : req.method === 'levelup-free' ? req.freePickLevel : undefined
  return {
    spellId: spell.id,
    spellLevel: spell.level,
    method: req.method,
    ...(freePickLevel ? { freePickLevel } : {}),
    costGp: learnCost(spell.level, req.method),
    ...(extra?.note ? { note: extra.note } : {}),
  }
}
