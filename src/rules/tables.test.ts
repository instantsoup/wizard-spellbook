import { describe, expect, it } from 'vitest'
import { abilityModifier, baseSpellsPerDay, bonusSpells, maxSpellLevel, minIntForSpellLevel, WIZARD_SPELLS_PER_DAY } from './tables'

describe('spells per day (PHB Table 3-18)', () => {
  it('matches spot-checked rows', () => {
    expect(WIZARD_SPELLS_PER_DAY[1].slice(0, 2)).toEqual([3, 1])
    expect(WIZARD_SPELLS_PER_DAY[5].slice(0, 4)).toEqual([4, 3, 2, 1])
    expect(WIZARD_SPELLS_PER_DAY[12].slice(0, 7)).toEqual([4, 4, 4, 4, 3, 3, 2])
    expect(WIZARD_SPELLS_PER_DAY[19]).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 3, 3])
    expect(WIZARD_SPELLS_PER_DAY[20]).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 4])
  })
  it('gains a new spell level at every odd level from 3 to 17', () => {
    for (let lvl = 1; lvl <= 20; lvl++) {
      expect(maxSpellLevel(lvl)).toBe(Math.min(9, Math.ceil(lvl / 2)))
    }
  })
  it('a new spell level starts with 1 slot, and slots never shrink with level', () => {
    for (let lvl = 2; lvl <= 20; lvl++) {
      for (let sl = 0; sl <= 9; sl++) {
        const now = baseSpellsPerDay(lvl, sl)
        const before = baseSpellsPerDay(lvl - 1, sl)
        if (before === null && now !== null && sl > 0) expect(now).toBe(1)
        if (before !== null) expect(now).toBeGreaterThanOrEqual(before)
      }
    }
  })
  it('returns null for spell levels not yet available', () => {
    expect(baseSpellsPerDay(1, 2)).toBeNull()
    expect(baseSpellsPerDay(16, 9)).toBeNull()
  })
  it('rejects levels outside 1–20', () => {
    expect(() => baseSpellsPerDay(0, 0)).toThrow()
    expect(() => maxSpellLevel(21)).toThrow()
  })
})

describe('ability modifier', () => {
  it.each([
    [1, -5],
    [9, -1],
    [10, 0],
    [11, 0],
    [16, 3],
    [17, 3],
    [18, 4],
    [34, 12],
  ])('Int %i -> %i', (score, mod) => expect(abilityModifier(score)).toBe(mod))
})

describe('bonus spells (PHB Table 1-1)', () => {
  const row = (int: number) => Array.from({ length: 9 }, (_, i) => bonusSpells(abilityModifier(int), i + 1))
  it.each([
    [10, [0, 0, 0, 0, 0, 0, 0, 0, 0]],
    [12, [1, 0, 0, 0, 0, 0, 0, 0, 0]],
    [16, [1, 1, 1, 0, 0, 0, 0, 0, 0]],
    [18, [1, 1, 1, 1, 0, 0, 0, 0, 0]],
    [20, [2, 1, 1, 1, 1, 0, 0, 0, 0]],
    [24, [2, 2, 2, 1, 1, 1, 1, 0, 0]],
    [28, [3, 2, 2, 2, 2, 1, 1, 1, 1]],
    [34, [3, 3, 3, 3, 2, 2, 2, 2, 1]],
  ])('Int %i', (int, expected) => expect(row(int)).toEqual(expected))
  it('never gives bonus cantrips', () => expect(bonusSpells(20, 0)).toBe(0))
})

it('minimum Int is 10 + spell level', () => {
  expect(minIntForSpellLevel(0)).toBe(10)
  expect(minIntForSpellLevel(9)).toBe(19)
})
