import { describe, expect, it } from 'vitest'
import { evoker5, generalist1, S } from './fixtures'
import {
  canLearn,
  freePicksGranted,
  freePickStatus,
  learnCost,
  makeKnownSpell,
  startingCantrips,
  totalFreePicksRemaining,
  totalSpent,
} from './known'
import type { KnownSpell } from './types'

const k = (spellId: string, spellLevel: number, extra: Partial<KnownSpell> = {}): KnownSpell => ({
  spellId,
  spellLevel,
  method: 'scroll',
  costGp: 0,
  ...extra,
})

describe('free picks', () => {
  it('starts with 3 + Int mod, then 2 per level', () => {
    expect([...freePicksGranted(generalist1)]).toEqual([[1, 6]])
    const g = freePicksGranted(evoker5)
    expect(g.get(1)).toBe(7)
    expect(g.get(5)).toBe(2)
    expect([...g.values()].reduce((a, b) => a + b)).toBe(7 + 2 * 4)
  })
  it('uses the Int mod from 1st level, not current Int', () => {
    const smarter = { ...evoker5, int: { base: 22, enhancement: 0, inherent: 0 } }
    expect(freePicksGranted(smarter).get(1)).toBe(7)
  })
  it('counts used picks per granting level', () => {
    const known = [
      k('magic-missile', 1, { method: 'starting-free', freePickLevel: 1 }),
      k('scorching-ray', 2, { method: 'levelup-free', freePickLevel: 3 }),
      k('fireball', 3, { method: 'scroll' }), // paid, doesn't use a pick
    ]
    const status = freePickStatus(evoker5, known)
    expect(status.find((s) => s.wizardLevel === 1)).toMatchObject({ used: 1, remaining: 6, maxSpellLevel: 1 })
    expect(status.find((s) => s.wizardLevel === 3)).toMatchObject({ used: 1, remaining: 1, maxSpellLevel: 2 })
    expect(totalFreePicksRemaining(evoker5, known)).toBe(15 - 2)
  })
})

describe('canLearn', () => {
  it('allows a paid spell from a scroll', () => {
    expect(canLearn(evoker5, S.fireball, [], { method: 'scroll' })).toMatchObject({ ok: true, warnings: [] })
  })
  it('blocks prohibited schools and duplicates', () => {
    expect(canLearn(evoker5, S.sleep, [], { method: 'scroll' }).ok).toBe(false)
    expect(canLearn(evoker5, S.fireball, [k('fireball', 3)], { method: 'scroll' }).ok).toBe(false)
  })
  it('cannot learn spells above the castable level', () => {
    const r = canLearn(evoker5, S.coneOfCold, [], { method: 'scroll' })
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/up to level 3/)
  })
  it('starting free picks must be 1st level', () => {
    expect(canLearn(generalist1, S.magicMissile, [], { method: 'starting-free' }).ok).toBe(true)
    expect(canLearn(generalist1, S.scorchingRay, [], { method: 'starting-free' }).ok).toBe(false)
  })
  it('level-up picks are limited to what that wizard level can cast', () => {
    expect(canLearn(evoker5, S.fireball, [], { method: 'levelup-free', freePickLevel: 5 }).ok).toBe(true)
    expect(canLearn(evoker5, S.fireball, [], { method: 'levelup-free', freePickLevel: 4 }).ok).toBe(false)
    expect(canLearn(evoker5, S.scorchingRay, [], { method: 'levelup-free', freePickLevel: 3 }).ok).toBe(true)
  })
  it('level-up picks need a reached level with picks remaining', () => {
    expect(canLearn(evoker5, S.haste, [], { method: 'levelup-free' }).ok).toBe(false)
    expect(canLearn(evoker5, S.haste, [], { method: 'levelup-free', freePickLevel: 6 }).ok).toBe(false)
    const used = [
      k('magic-missile', 1, { method: 'levelup-free', freePickLevel: 5 }),
      k('mage-armor', 1, { method: 'levelup-free', freePickLevel: 5 }),
    ]
    expect(canLearn(evoker5, S.haste, used, { method: 'levelup-free', freePickLevel: 5 }).ok).toBe(false)
  })
  it('warns when Int is too low to ever prepare the spell', () => {
    const lowInt = { ...evoker5, int: { base: 12, enhancement: 0, inherent: 0 } }
    const r = canLearn(lowInt, S.fireball, [], { method: 'scroll' })
    expect(r.ok).toBe(true)
    expect(r.warnings).toEqual(['You need Int 13 to prepare this spell.'])
  })
})

describe('costs', () => {
  it('100 gp per spell level, cantrips count as 1, free methods cost 0', () => {
    expect(learnCost(3, 'scroll')).toBe(300)
    expect(learnCost(0, 'other-book')).toBe(100)
    expect(learnCost(4, 'research')).toBe(400)
    expect(learnCost(5, 'levelup-free')).toBe(0)
    expect(learnCost(1, 'starting-free')).toBe(0)
  })
  it('makeKnownSpell fills in the fixed cost', () => {
    expect(makeKnownSpell(S.fireball, { method: 'scroll' }, { extraCostGp: 375 })).toEqual({
      spellId: 'fireball',
      spellLevel: 3,
      method: 'scroll',
      costGp: 300,
      extraCostGp: 375,
    })
    expect(makeKnownSpell(S.haste, { method: 'levelup-free', freePickLevel: 5 })).toMatchObject({
      costGp: 0,
      freePickLevel: 5,
    })
  })
  it('totals gold spent including extra costs', () => {
    expect(totalSpent([k('a', 3, { costGp: 300, extraCostGp: 375 }), k('b', 1, { costGp: 100 })])).toBe(775)
  })
})

describe('startingCantrips', () => {
  it('includes every cantrip except prohibited schools', () => {
    const all = Object.values(S)
    expect(startingCantrips(generalist1, all).map((s) => s.id)).toEqual(['detect-magic', 'daze', 'ray-of-frost'])
    expect(startingCantrips(evoker5, all).map((s) => s.id)).toEqual(['detect-magic', 'ray-of-frost'])
  })
})
