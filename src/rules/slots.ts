import { effectiveInt } from './character'
import { abilityModifier, baseSpellsPerDay, bonusSpells, maxSpellLevel, minIntForSpellLevel } from './tables'
import type { SlotKind, WizardCharacter } from './types'

export interface LevelSlots {
  spellLevel: number
  base: number
  bonus: number
  specialist: number
  total: number
  /** Int is below 10 + spell level: the slots exist but can't be used. */
  locked: boolean
}

/** Slots per day for every spell level the wizard has access to (0 to max). */
export function computeSlots(c: WizardCharacter): LevelSlots[] {
  const castInt = effectiveInt(c)
  const bonusMod = abilityModifier(castInt)
  const result: LevelSlots[] = []

  for (let spellLevel = 0; spellLevel <= maxSpellLevel(c.wizardLevel); spellLevel++) {
    const base = baseSpellsPerDay(c.wizardLevel, spellLevel) ?? 0
    const bonus = bonusSpells(bonusMod, spellLevel)
    // PHB: one extra spell of the specialty school per spell level, cantrips included.
    const specialist = c.specialty ? 1 : 0
    result.push({
      spellLevel,
      base,
      bonus,
      specialist,
      total: base + bonus + specialist,
      locked: castInt < minIntForSpellLevel(spellLevel),
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
