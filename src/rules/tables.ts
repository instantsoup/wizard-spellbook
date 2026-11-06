// PHB Table 3-18 (Wizard spells per day) and Table 1-1 (bonus spells).

/**
 * Base spells per day. Row index = wizard level (row 0 unused);
 * column = spell level 0–9; null = no access ("–" in the table).
 */
const _ = null
export const WIZARD_SPELLS_PER_DAY: readonly (readonly (number | null)[])[] = [
  [], // level 0 placeholder
  /*  1 */ [3, 1, _, _, _, _, _, _, _, _],
  /*  2 */ [4, 2, _, _, _, _, _, _, _, _],
  /*  3 */ [4, 2, 1, _, _, _, _, _, _, _],
  /*  4 */ [4, 3, 2, _, _, _, _, _, _, _],
  /*  5 */ [4, 3, 2, 1, _, _, _, _, _, _],
  /*  6 */ [4, 3, 3, 2, _, _, _, _, _, _],
  /*  7 */ [4, 4, 3, 2, 1, _, _, _, _, _],
  /*  8 */ [4, 4, 3, 3, 2, _, _, _, _, _],
  /*  9 */ [4, 4, 4, 3, 2, 1, _, _, _, _],
  /* 10 */ [4, 4, 4, 3, 3, 2, _, _, _, _],
  /* 11 */ [4, 4, 4, 4, 3, 2, 1, _, _, _],
  /* 12 */ [4, 4, 4, 4, 3, 3, 2, _, _, _],
  /* 13 */ [4, 4, 4, 4, 4, 3, 2, 1, _, _],
  /* 14 */ [4, 4, 4, 4, 4, 3, 3, 2, _, _],
  /* 15 */ [4, 4, 4, 4, 4, 4, 3, 2, 1, _],
  /* 16 */ [4, 4, 4, 4, 4, 4, 3, 3, 2, _],
  /* 17 */ [4, 4, 4, 4, 4, 4, 4, 3, 2, 1],
  /* 18 */ [4, 4, 4, 4, 4, 4, 4, 3, 3, 2],
  /* 19 */ [4, 4, 4, 4, 4, 4, 4, 4, 3, 3],
  /* 20 */ [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
]

export const MIN_WIZARD_LEVEL = 1
export const MAX_WIZARD_LEVEL = 20

function assertWizardLevel(level: number) {
  if (!Number.isInteger(level) || level < MIN_WIZARD_LEVEL || level > MAX_WIZARD_LEVEL) {
    throw new RangeError(`wizard level must be 1–20 (got ${level})`)
  }
}

/** Base slots for a spell level, or null if the wizard has no access to it yet. */
export function baseSpellsPerDay(wizardLevel: number, spellLevel: number): number | null {
  assertWizardLevel(wizardLevel)
  return WIZARD_SPELLS_PER_DAY[wizardLevel][spellLevel] ?? null
}

/** Highest spell level the wizard has slots for (1 at 1st level, 9 at 17th). */
export function maxSpellLevel(wizardLevel: number): number {
  assertWizardLevel(wizardLevel)
  const row = WIZARD_SPELLS_PER_DAY[wizardLevel]
  let max = 0
  row.forEach((n, i) => {
    if (n !== null) max = i
  })
  return max
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/** Table 1-1 bonus spells for one spell level. Cantrips never get bonus spells. */
export function bonusSpells(abilityMod: number, spellLevel: number): number {
  if (spellLevel < 1 || spellLevel > 9) return 0
  if (abilityMod < spellLevel) return 0
  return Math.floor((abilityMod - spellLevel) / 4) + 1
}

/** A wizard needs Int 10 + spell level to prepare or cast a spell of that level. */
export function minIntForSpellLevel(spellLevel: number): number {
  return 10 + spellLevel
}
