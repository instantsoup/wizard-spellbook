import { describe, expect, it } from 'vitest'
import { bonusSpellInt, effectiveInt, validateCharacter } from './character'
import { diviner9, evoker5, generalist1 } from './fixtures'

describe('validateCharacter', () => {
  it('accepts the sample characters', () => {
    expect(validateCharacter(generalist1).errors).toEqual([])
    expect(validateCharacter(evoker5).errors).toEqual([])
    expect(validateCharacter(diviner9).errors).toEqual([])
  })
  it('needs exactly two prohibited schools for a specialist', () => {
    expect(validateCharacter({ ...evoker5, prohibited: ['Illusion'] }).ok).toBe(false)
    expect(validateCharacter({ ...evoker5, prohibited: ['Illusion', 'Enchantment', 'Necromancy'] }).ok).toBe(false)
  })
  it('lets a Divination specialist give up only one school', () => {
    expect(validateCharacter({ ...diviner9, prohibited: ['Necromancy', 'Illusion'] }).ok).toBe(false)
  })
  it('never allows prohibiting Divination or Universal', () => {
    expect(validateCharacter({ ...evoker5, prohibited: ['Divination', 'Illusion'] }).ok).toBe(false)
    expect(validateCharacter({ ...evoker5, prohibited: ['Universal', 'Illusion'] }).ok).toBe(false)
  })
  it('rejects prohibiting your own specialty, or Universal as a specialty', () => {
    expect(validateCharacter({ ...evoker5, prohibited: ['Evocation', 'Illusion'] }).ok).toBe(false)
    expect(validateCharacter({ ...evoker5, specialty: 'Universal' }).ok).toBe(false)
  })
  it('a generalist has no prohibited schools', () => {
    expect(validateCharacter({ ...generalist1, prohibited: ['Illusion'] }).ok).toBe(false)
  })
  it('rejects levels outside 1–20', () => {
    expect(validateCharacter({ ...generalist1, wizardLevel: 0 }).ok).toBe(false)
    expect(validateCharacter({ ...generalist1, wizardLevel: 21 }).ok).toBe(false)
  })
  it('warns when Int is too low to cast 1st-level spells', () => {
    const r = validateCharacter({ ...generalist1, int: { base: 10, enhancement: 0, inherent: 0 }, intModAtLevel1: 0 })
    expect(r.ok).toBe(true)
    expect(r.warnings.length).toBeGreaterThan(0)
  })
})

describe('Int totals', () => {
  it('adds enhancement and inherent bonuses', () => {
    expect(effectiveInt(diviner9)).toBe(24)
    expect(bonusSpellInt(diviner9)).toBe(24)
  })
  it('can leave enhancement out of bonus spells by house rule', () => {
    expect(bonusSpellInt({ ...diviner9, houseRules: { enhancementCountsForBonus: false } })).toBe(20)
  })
})
