import { bonusSpellModifier, casterLevel, meetsCastingMinimum, spellDc } from './character'
import { baseSpellsPerDay, bonusSpells, maxSpellLevel } from './tables'
import type { SlotKind, WizardCharacter } from './types'

export interface LevelSlots {
  spellLevel: number
  base: number
  bonus: number
  specialist: number
  total: number
  /** Int is below 10 + spell level: the slots exist but can't be used. */
  locked: boolean
  /** Save DC for spells of this level. */
  dc: number
}

/** Slots per day for every spell level the wizard has access to (0 to max). */
export function computeSlots(c: WizardCharacter): LevelSlots[] {
  const bonusMod = bonusSpellModifier(c)
  const cl = casterLevel(c)
  const result: LevelSlots[] = []

  for (let spellLevel = 0; spellLevel <= maxSpellLevel(cl); spellLevel++) {
    const base = baseSpellsPerDay(cl, spellLevel) ?? 0
    const bonus = bonusSpells(bonusMod, spellLevel)
    // PHB: one extra spell of the specialty school per spell level, cantrips included.
    const specialist = c.specialty ? 1 : 0
    result.push({
      spellLevel,
      base,
      bonus,
      specialist,
      total: base + bonus + specialist,
      locked: !meetsCastingMinimum(c, spellLevel),
      dc: spellDc(c, spellLevel),
    })
  }
  return result
}

export interface SlotRef {
  slotLevel: number
  kind: SlotKind
}

/** One entry per individual slot, in display order: base, bonus, specialist per level. */
export function listSlots(c: WizardCharacter): SlotRef[] {
  return computeSlots(c).flatMap((l) => [
    ...Array.from({ length: l.base }, () => ({ slotLevel: l.spellLevel, kind: 'base' as const })),
    ...Array.from({ length: l.bonus }, () => ({ slotLevel: l.spellLevel, kind: 'bonus' as const })),
    ...Array.from({ length: l.specialist }, () => ({ slotLevel: l.spellLevel, kind: 'specialist' as const })),
  ])
}
