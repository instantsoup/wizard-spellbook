import { describe, expect, it } from 'vitest'
import { evoker5, S } from '../../rules/fixtures'
import { EMPTY_FILTERS, activeFilterCount, filterSpells } from './filters'
import { spellsForClass } from '../../data/spell-schema'

const spells = Object.values(S).map((s) =>
  s.id === 'fireball' ? { ...s, descriptors: ['Fire'], components: ['V', 'S', 'M'], summary: '1d6 damage per level, 20-ft. radius.' } : s,
)
const knownIds = new Set(['magic-missile'])
const run = (f: Partial<typeof EMPTY_FILTERS>) =>
  filterSpells(spells, { ...EMPTY_FILTERS, ...f }, { character: evoker5, knownIds }).map((s) => s.id)

describe('filterSpells', () => {
  it('returns everything except prohibited schools with no filters', () => {
    // evoker5 prohibits Enchantment and Illusion: Daze, Sleep, Invisibility
    expect(run({})).toHaveLength(spells.length - 3)
  })
  it('filters by levels and schools (multi-select)', () => {
    expect(run({ levels: [3] })).toEqual(['fireball', 'haste'])
    expect(run({ levels: [1, 2], schools: ['Evocation'] })).toEqual(['magic-missile', 'scorching-ray'])
  })
  it('hides spells already known', () => {
    expect(run({ notInBook: true, levels: [1] })).not.toContain('magic-missile')
  })
  it('castable now = level the wizard can cast', () => {
    expect(run({ castableNow: true }).every((id) => spells.find((s) => s.id === id)!.level <= 3)).toBe(true)
    expect(run({ castableNow: true })).not.toContain('cone-of-cold')
  })
  it('never shows prohibited schools, even if a saved filter asks for them', () => {
    expect(run({})).not.toContain('sleep')
    expect(run({ query: 'sleep' })).toEqual([])
    expect(run({ schools: ['Enchantment'] })).toHaveLength(spells.length - 3)
  })
  it('excludes components and matches descriptors', () => {
    expect(run({ without: ['M'] })).not.toContain('fireball')
    expect(run({ descriptor: 'Fire' })).toEqual(['fireball'])
  })
  it('searches names and summaries with prefixes and typos', () => {
    expect(run({ query: 'firebal' })).toEqual(['fireball'])
    expect(run({ query: 'radius' })).toEqual(['fireball'])
    expect(run({ query: 'magic' })[0]).toBe('magic-missile')
  })
})

it('counts active filter groups', () => {
  expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
  expect(activeFilterCount({ ...EMPTY_FILTERS, levels: [1, 2], notInBook: true })).toBe(2)
})

describe('browsing without a character', () => {
  const cure = { ...S.mageArmor, id: 'cure', name: 'Cure', school: 'Conjuration' as const, levels: { Clr: 1, Rgr: 2 } }
  const records = [cure, { ...S.daze }, { ...S.fireball, levels: { Sor: 3, Wiz: 3 }, domains: { Fire: 2 } }]

  it('shows every spell on the "all" list at its lowest level, prohibited schools included', () => {
    const all = spellsForClass(records, 'all')
    expect(all.map((s) => [s.id, s.level])).toEqual([['cure', 1], ['daze', 0], ['fireball', 2]])
    expect(filterSpells(all, EMPTY_FILTERS, {})).toHaveLength(3)
  })

  it('matches a level filter on any list, and ignores book filters', () => {
    const all = spellsForClass(records, 'all')
    expect(filterSpells(all, { ...EMPTY_FILTERS, levels: [2] }, { anyLevel: true }).map((s) => s.id)).toEqual(['cure', 'fireball'])
    expect(filterSpells(all, { ...EMPTY_FILTERS, levels: [2] }, {}).map((s) => s.id)).toEqual(['fireball'])
    expect(filterSpells(all, { ...EMPTY_FILTERS, notInBook: true, castableNow: true }, {})).toHaveLength(3)
  })
})
