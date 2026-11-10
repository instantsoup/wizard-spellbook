import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { slugify, validateSpell, validateSpellFile } from './spell-schema'

const good = {
  id: 'orb-of-fire',
  name: 'Orb of Fire',
  school: 'Conjuration',
  descriptors: ['Fire'],
  level: 4,
  components: ['V', 'S'],
  description: 'Boom.',
  source: 'Homebrew',
}

describe('validateSpell', () => {
  it('accepts a minimal valid spell', () => {
    expect(validateSpell(good)).toEqual([])
  })
  it('rejects bad school, level, components and unknown fields', () => {
    const errors = validateSpell({ ...good, school: 'Wizardry', level: 10, components: ['Q'], colour: 'red' })
    expect(errors).toHaveLength(4)
  })
  it('requires lowercase-kebab ids', () => {
    expect(validateSpell({ ...good, id: 'Orb Of Fire' })).toHaveLength(1)
  })
  it('allows level 0 and 9 but not -1', () => {
    expect(validateSpell({ ...good, level: 0 })).toEqual([])
    expect(validateSpell({ ...good, level: 9 })).toEqual([])
    expect(validateSpell({ ...good, level: -1 })).toHaveLength(1)
  })
})

describe('validateSpellFile', () => {
  it('flags duplicate ids', () => {
    expect(validateSpellFile([good, good])).toEqual(['Orb of Fire: duplicate id "orb-of-fire"'])
  })
  it('requires an array', () => {
    expect(validateSpellFile({})).toHaveLength(1)
  })
})

describe('slugify', () => {
  it('makes ids from SRD names', () => {
    expect(slugify('Bull’s Strength, Mass')).toBe('bulls-strength-mass')
    expect(slugify('Geas/Quest')).toBe('geas-quest')
  })
})

describe('bundled SRD data', () => {
  const srd = JSON.parse(readFileSync('public/data/spells/srd.json', 'utf8'))
  it('is valid', () => {
    expect(validateSpellFile(srd)).toEqual([])
  })
  it('has the 19 PHB cantrips and wizard-only spells', () => {
    expect(srd.filter((s: { level: number }) => s.level === 0)).toHaveLength(19)
    const ids = new Set(srd.map((s: { id: string }) => s.id))
    expect(ids.has('mages-lucubration')).toBe(true)
    expect(ids.has('fireball')).toBe(true)
  })
})

describe('bundled extra index', () => {
  const extra = JSON.parse(readFileSync('public/data/spells/index-extra.json', 'utf8'))
  const srdIds = new Set(JSON.parse(readFileSync('public/data/spells/srd.json', 'utf8')).map((s: { id: string }) => s.id))
  it('is valid and never overrides a full-text SRD spell', () => {
    expect(validateSpellFile(extra)).toEqual([])
    expect(extra.filter((s: { id: string }) => srdIds.has(s.id))).toEqual([])
  })
  it('is listed in the manifest after srd.json', () => {
    expect(JSON.parse(readFileSync('public/data/spells/manifest.json', 'utf8'))).toEqual(['srd.json', 'index-extra.json', 'index-books.json'])
  })
})

describe('bundled book index (from dndtools)', () => {
  const books = JSON.parse(readFileSync('public/data/spells/index-books.json', 'utf8'))
  const earlier = new Set(
    ['srd.json', 'index-extra.json'].flatMap((f) => JSON.parse(readFileSync(`public/data/spells/${f}`, 'utf8')).map((s: { id: string }) => s.id)),
  )
  it('is valid and never overrides an earlier spell', () => {
    expect(validateSpellFile(books)).toEqual([])
    expect(books.filter((s: { id: string }) => earlier.has(s.id))).toEqual([])
  })
  it('only has spells from the allowed books', () => {
    const allowed = new Set([
      "Player's Handbook II", 'Complete Mage', 'Complete Arcane', 'Complete Adventurer', 'Complete Divine', 'Complete Scoundrel',
      'Complete Warrior', 'Cityscape', 'Draconomicon', 'Dragon Magic', 'Frostburn', 'Heroes of Horror', 'Libris Mortis',
      'Magic of Incarnum', 'Races of Destiny', 'Races of the Dragon', 'Races of Stone', 'Races of the Wild', 'Tome of Magic',
      'Weapons of Legacy', 'Book of Exalted Deeds',
    ])
    expect(books.filter((s: { source: string }) => !allowed.has(s.source))).toEqual([])
  })
})
