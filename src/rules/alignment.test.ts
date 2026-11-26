import { describe, expect, it } from 'vitest'
import { alignmentBar, alignmentNotes, canFillSlot, canLearn } from '.'
import { evoker5, S } from './fixtures'

const sanctified = { ...S.mageArmor, id: 'twilight-luck', name: 'Twilight Luck', descriptors: ['Good'], special: 'Sanctified' as const }
const corrupt = { ...S.mageArmor, id: 'absorb-mind', name: 'Absorb Mind', descriptors: ['Evil'], special: 'Corrupt' as const }
const evilSpell = { ...S.mageArmor, id: 'unholy', name: 'Unholy', descriptors: ['Evil'] }

describe('alignment', () => {
  it('evil characters cannot learn or prepare sanctified spells', () => {
    const evil = { ...evoker5, alignment: 'NE' as const }
    expect(alignmentBar(evil, sanctified)).toMatch(/can't cast sanctified/)
    expect(canLearn(evil, sanctified, [], { method: 'research' }).errors).toContain("Evil characters can't cast sanctified spells.")
    expect(canFillSlot(evil, { slotLevel: 1, kind: 'base' }, sanctified, new Set([sanctified.id])).ok).toBe(false)
    expect(alignmentBar({ ...evoker5, alignment: 'N' }, sanctified)).toBeUndefined()
  })

  it('no alignment set: no checks', () => {
    expect(alignmentBar(evoker5, sanctified)).toBeUndefined()
    expect(alignmentNotes(evoker5, evilSpell)).toEqual([])
  })

  it('notes opposed alignment spells without blocking them; corrupt spells count as evil', () => {
    const good = { ...evoker5, alignment: 'LG' as const }
    expect(alignmentNotes(good, evilSpell)).toEqual(['Casting an evil spell is an evil act.'])
    expect(alignmentNotes(good, corrupt)).toEqual(['Casting an evil spell is an evil act.'])
    const r = canLearn(good, evilSpell, [], { method: 'research' })
    expect(r.ok).toBe(true)
    expect(r.warnings).toContain('Casting an evil spell is an evil act.')
    expect(alignmentNotes({ ...evoker5, alignment: 'CE' }, { descriptors: ['Lawful', 'Good'] })).toEqual([
      'Casting a lawful spell is a lawful act.',
      'Casting a good spell is a good act.',
    ])
    expect(alignmentNotes({ ...evoker5, alignment: 'N' }, evilSpell)).toEqual([])
  })
})
