import { describe, expect, it } from 'vitest'
import { bonusSpellModifier, casterLevel, dcModifier, meetsCastingMinimum, spellDc, validateCharacter } from './character'
import { evoker5, generalist1, S } from './fixtures'
import { canLearn, freePickStatus } from './known'
import { computeSlots } from './slots'

describe('casting modifier and caster level', () => {
  it('uses the Int modifier by default', () => {
    expect(bonusSpellModifier(evoker5)).toBe(4)
    expect(dcModifier(evoker5)).toBe(4)
    expect(spellDc(evoker5, 3)).toBe(17)
    expect(computeSlots(evoker5).map((l) => l.dc)).toEqual([14, 15, 16, 17])
  })

  it('custom modifiers set bonus spells and DCs separately, with no minimum Int', () => {
    const scholar = { ...generalist1, wizardLevel: 3, int: { base: 10, enhancement: 0, inherent: 0 }, customCasting: { bonusSpells: 5, dc: 3 } }
    const slots = computeSlots(scholar)
    // +5: bonus 2/1 at levels 1-2
    expect(slots.map((l) => l.bonus)).toEqual([0, 2, 1])
    expect(slots.every((l) => !l.locked)).toBe(true)
    expect(spellDc(scholar, 2)).toBe(15)
    expect(meetsCastingMinimum(scholar, 9)).toBe(true)
    // Int 10 alone would lock 1st-level spells
    expect(meetsCastingMinimum({ ...scholar, customCasting: undefined }, 1)).toBe(false)
  })

  it('prestige class levels add to spells per day and free picks', () => {
    const c = { ...evoker5, extraCasterLevels: 3 }
    expect(casterLevel(c)).toBe(8)
    expect(computeSlots(c)).toHaveLength(5) // up to 4th level
    const picks = freePickStatus(c, [])
    expect(picks.map((p) => p.wizardLevel)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(picks.at(-1)?.maxSpellLevel).toBe(4)
    expect(casterLevel({ ...evoker5, wizardLevel: 18, extraCasterLevels: 5 })).toBe(20)
    expect(validateCharacter({ ...evoker5, extraCasterLevels: -1 }).ok).toBe(false)
  })

  it('learning uses caster level', () => {
    const fourth = S.wallOfFire
    expect(canLearn(evoker5, fourth, [], { method: 'scroll' }).ok).toBe(false)
    expect(canLearn({ ...evoker5, extraCasterLevels: 2 }, fourth, [], { method: 'scroll' }).ok).toBe(true)
  })
})
