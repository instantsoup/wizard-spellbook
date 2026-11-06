import { describe, expect, it } from 'vitest'
import { evoker5, S } from '../../rules/fixtures'
import { EMPTY_FILTERS, activeFilterCount, filterSpells } from './filters'

const spells = Object.values(S).map((s) =>
  s.id === 'fireball' ? { ...s, descriptors: ['Fire'], components: ['V', 'S', 'M'], summary: '1d6 damage per level, 20-ft. radius.' } : s,
)
const knownIds = new Set(['magic-missile'])
const run = (f: Partial<typeof EMPTY_FILTERS>) =>
  filterSpells(spells, { ...EMPTY_FILTERS, ...f }, { character: evoker5, knownIds }).map((s) => s.id)

describe('filterSpells', () => {
  it('returns everything with no filters', () => {
    expect(run({})).toHaveLength(spells.length)
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
  it('hides prohibited schools', () => {
    expect(run({ hideProhibited: true })).not.toContain('sleep')
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
