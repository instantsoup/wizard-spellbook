import { describe, expect, it } from 'vitest'
import { evoker5, S } from './fixtures'
import { candidatesForSlot, canFillSlot, dayUsage, emptyDay, reconcileDay, setExpended, validateDay } from './preparation'
import type { PreparedSlot } from './types'

const known = [S.rayOfFrost, S.magicMissile, S.mageArmor, S.scorchingRay, S.fireball, S.haste, S.identify]
const knownIds = new Set(known.map((s) => s.id))
const byId = new Map(Object.values(S).map((s) => [s.id, s]))

describe('canFillSlot', () => {
  it('fits a spell in a slot of its level or higher', () => {
    expect(canFillSlot(evoker5, { slotLevel: 3, kind: 'base' }, S.fireball, knownIds).ok).toBe(true)
    expect(canFillSlot(evoker5, { slotLevel: 3, kind: 'base' }, S.magicMissile, knownIds).ok).toBe(true)
    expect(canFillSlot(evoker5, { slotLevel: 2, kind: 'base' }, S.fireball, knownIds).ok).toBe(false)
  })
  it('specialist slots take only specialty-school spells', () => {
    expect(canFillSlot(evoker5, { slotLevel: 3, kind: 'specialist' }, S.fireball, knownIds).ok).toBe(true)
    expect(canFillSlot(evoker5, { slotLevel: 3, kind: 'specialist' }, S.haste, knownIds).ok).toBe(false)
  })
  it('requires the spell to be known', () => {
    expect(canFillSlot(evoker5, { slotLevel: 4, kind: 'base' }, S.wallOfFire, knownIds).ok).toBe(false)
  })
  it('rejects slots the wizard does not have or cannot use', () => {
    expect(canFillSlot(evoker5, { slotLevel: 4, kind: 'base' }, S.fireball, knownIds).ok).toBe(false)
    const lowInt = { ...evoker5, int: { base: 12, enhancement: 0, inherent: 0 } }
    expect(canFillSlot(lowInt, { slotLevel: 3, kind: 'base' }, S.fireball, knownIds).ok).toBe(false)
  })
})

describe('candidatesForSlot', () => {
  it('lists legal known spells, highest level first', () => {
    const ids = candidatesForSlot(evoker5, { slotLevel: 2, kind: 'specialist' }, known).map((s) => s.id)
    expect(ids).toEqual(['scorching-ray', 'magic-missile', 'ray-of-frost'])
  })
})

describe('a day of preparation', () => {
  it('starts with every slot open', () => {
    const day = emptyDay(evoker5)
    expect(day).toHaveLength(17)
    expect(day.every((s) => !s.spellId && !s.expended)).toBe(true)
  })

  it('validates filled slots and allows open ones', () => {
    const day = emptyDay(evoker5)
    const i = day.findIndex((s) => s.slotLevel === 3 && s.kind === 'specialist')
    day[i] = { ...day[i], spellId: 'fireball' }
    expect(validateDay(evoker5, day, byId, knownIds)).toMatchObject({ ok: true, warnings: [] })
    day[i] = { ...day[i], spellId: 'haste' }
    expect(validateDay(evoker5, day, byId, knownIds).ok).toBe(false)
  })

  it('warns when the slot layout no longer matches the character', () => {
    const day = emptyDay(evoker5)
    const leveled = { ...evoker5, wizardLevel: 6 }
    expect(validateDay(leveled, day, byId, knownIds).warnings).toHaveLength(1)
  })

  it('tracks cast spells per level', () => {
    let day: PreparedSlot[] = emptyDay(evoker5).map((s) =>
      s.slotLevel === 3 ? { ...s, spellId: 'fireball' } : s,
    )
    const first3 = day.findIndex((s) => s.slotLevel === 3)
    day = setExpended(day, first3, true)
    expect(dayUsage(day).find((u) => u.spellLevel === 3)).toEqual({
      spellLevel: 3,
      total: 3,
      prepared: 3,
      open: 0,
      expended: 1,
      remaining: 2,
    })
    // open slots can't be expended
    const open = day.findIndex((s) => !s.spellId)
    expect(setExpended(day, open, true)[open].expended).toBe(false)
  })

  it('carries picks into a new day and into a new slot layout', () => {
    let day = emptyDay(evoker5).map((s) => (s.slotLevel === 1 ? { ...s, spellId: 'magic-missile' } : s))
    day = setExpended(day, day.findIndex((s) => s.slotLevel === 1), true)
    const next = reconcileDay(evoker5, day)
    expect(next.filter((s) => s.spellId === 'magic-missile')).toHaveLength(5)
    expect(next.some((s) => s.expended)).toBe(false)

    const leveled = reconcileDay({ ...evoker5, wizardLevel: 7 }, day)
    expect(leveled.filter((s) => s.slotLevel === 4)).toHaveLength(3) // new 4th-level slots: base 1, bonus 1, specialist 1
    expect(leveled.filter((s) => s.spellId === 'magic-missile')).toHaveLength(5)
  })
})
