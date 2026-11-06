import { describe, expect, it } from 'vitest'
import { diviner9, evoker5, generalist1, generalist20 } from './fixtures'
import { computeSlots, listSlots } from './slots'

const totals = (c: Parameters<typeof computeSlots>[0]) => computeSlots(c).map((l) => l.total)

describe('computeSlots', () => {
  it('1st-level generalist, Int 16', () => {
    // base 3/1, bonus 0/1
    expect(totals(generalist1)).toEqual([3, 2])
  })
  it('5th-level evoker, Int 18: base + bonus + specialist', () => {
    const slots = computeSlots(evoker5)
    expect(slots.map((l) => [l.base, l.bonus, l.specialist])).toEqual([
      [4, 0, 1],
      [3, 1, 1],
      [2, 1, 1],
      [1, 1, 1],
    ])
    expect(totals(evoker5)).toEqual([5, 5, 4, 3])
  })
  it('9th-level diviner, Int 20 + 4 headband', () => {
    // Int 24 (+7): bonus 2/2/2/1/1
    expect(totals(diviner9)).toEqual([5, 7, 7, 6, 4, 3])
  })
  it('20th-level generalist, Int 34', () => {
    expect(totals(generalist20)).toEqual([4, 7, 7, 7, 7, 6, 6, 6, 6, 5])
  })
  it('only gives bonus slots for spell levels the wizard can already cast', () => {
    // Int 34 would give 9th-level bonus spells, but a 1st-level wizard has no 2nd+ slots
    expect(computeSlots({ ...generalist1, int: { base: 34, enhancement: 0, inherent: 0 } })).toHaveLength(2)
  })
  it('house rule: no specialist cantrip slot', () => {
    expect(totals({ ...evoker5, houseRules: { specialistCantripSlot: false } })).toEqual([4, 5, 4, 3])
  })
  it('house rule: headband does not count for bonus spells', () => {
    // Int 20 (+5): bonus 2/1/1/1/1
    expect(totals({ ...diviner9, houseRules: { enhancementCountsForBonus: false } })).toEqual([5, 7, 6, 5, 4, 3])
  })
  it('locks levels whose minimum Int the wizard lacks', () => {
    const lowInt = { ...evoker5, int: { base: 12, enhancement: 0, inherent: 0 } }
    expect(computeSlots(lowInt).map((l) => l.locked)).toEqual([false, false, false, true])
  })
})

describe('listSlots', () => {
  it('lists every slot in order: base, bonus, specialist', () => {
    const level1 = listSlots(evoker5).filter((s) => s.slotLevel === 1)
    expect(level1.map((s) => s.kind)).toEqual(['base', 'base', 'base', 'bonus', 'specialist'])
    expect(listSlots(evoker5)).toHaveLength(17)
  })
})
