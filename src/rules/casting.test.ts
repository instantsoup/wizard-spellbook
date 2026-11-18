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

  it('a custom score sets bonus spells and the casting minimum; the DC modifier is separate', () => {
    // Tainted Scholar: depravity 20 -> score 30 (+10); corruption 24 -> DC +12
    const scholar = { ...generalist1, wizardLevel: 3, int: { base: 10, enhancement: 0, inherent: 0 }, customCasting: { score: 30, dc: 12 } }
    const slots = computeSlots(scholar)
    expect(bonusSpellModifier(scholar)).toBe(10)
    expect(slots.map((l) => l.bonus)).toEqual([0, 3, 3])
    expect(slots.every((l) => !l.locked)).toBe(true)
    expect(spellDc(scholar, 2)).toBe(24)
    expect(meetsCastingMinimum({ ...scholar, customCasting: { score: 12, dc: 0 } }, 3)).toBe(false)
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
