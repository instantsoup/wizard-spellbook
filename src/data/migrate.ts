/**
 * Brings a saved character up to date. Used by the database upgrade and by backup restore.
 * - `houseRules` (table rules) were removed.
 * - Custom casting first stored a bonus-spell modifier; it now stores the score (10 + 2 x modifier).
 */
export function migrateCharacter(c: Record<string, unknown>): Record<string, unknown> {
  const { houseRules: _h, ...out } = c
  const cc = out.customCasting as { bonusSpells?: number; score?: number; dc: number } | undefined
  if (cc && cc.score === undefined && typeof cc.bonusSpells === 'number') {
    out.customCasting = { score: 10 + 2 * cc.bonusSpells, dc: cc.dc }
  }
  return out
}
