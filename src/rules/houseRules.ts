// Table-variable rules. Every rules function takes resolved HouseRules so the UI can
// expose these as settings without any rule logic leaking into components.

export type AboveCastablePolicy = 'off' | 'warn' | 'allow'

export interface HouseRules {
  /** Learning a spell of a level the wizard can't cast yet. */
  aboveCastableLevel: AboveCastablePolicy
  /** Gold per spell level for learned (non-free) spells. Cantrips count as level 1. */
  gpPerSpellLevel: number
  /** Specialists get their extra specialty slot at spell level 0 too. */
  specialistCantripSlot: boolean
  /** Enhancement bonuses to Int (e.g. a headband) count toward bonus spells. */
  enhancementCountsForBonus: boolean
}

export const DEFAULT_HOUSE_RULES: HouseRules = {
  aboveCastableLevel: 'warn',
  gpPerSpellLevel: 100,
  specialistCantripSlot: true,
  enhancementCountsForBonus: true,
}

export function resolveHouseRules(partial?: Partial<HouseRules>): HouseRules {
  return { ...DEFAULT_HOUSE_RULES, ...partial }
}
