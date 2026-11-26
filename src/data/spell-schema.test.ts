import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { levelLine, slugify, spellsForClass, validateSpell, validateSpellFile, type ClassCode, type SpellRecord } from './spell-schema'

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
  it('accepts class levels and domains, and rejects unknown classes', () => {
    const { level: _l, ...noLevel } = good
    expect(validateSpell({ ...noLevel, levels: { Clr: 3, Sor: 4, Wiz: 4 }, domains: { Fire: 4 } })).toEqual([])
    expect(validateSpell({ ...noLevel, levels: { Cleric: 3 } })).toHaveLength(1)
    expect(validateSpell(noLevel)).toHaveLength(1)
  })
  it('writes the Level line', () => {
    expect(levelLine({ levels: { Wiz: 4, Sor: 4, Clr: 3 }, domains: { Fire: 4 } })).toBe('Clr 3, Sor/Wiz 4, Fire 4')
    expect(levelLine({ level: 2 })).toBe('Sor/Wiz 2')
    expect(levelLine({ levels: { Wiz: 6 } })).toBe('Wiz 6')
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

describe('corrupt and sanctified spells', () => {
  const absorb = { ...good, id: 'absorb-mind', name: 'Absorb Mind', levels: { Clr: 3, Drd: 3, Pal: 3, Rgr: 3, Wiz: 3 }, special: 'Corrupt' as const }
  it('show one level for every list', () => {
    expect(levelLine(absorb)).toBe('Corrupt 3')
    expect(validateSpell(absorb)).toEqual([])
    expect(validateSpell({ ...absorb, special: 'Vile' })).toContain('"special" must be one of Corrupt, Sanctified')
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
  it('has the 19 PHB wizard cantrips and wizard-only spells', () => {
    const wiz = spellsForClass(srd, 'Wiz')
    expect(wiz.filter((s) => s.level === 0)).toHaveLength(19)
    expect(wiz).toHaveLength(377)
    const byId = new Map(srd.map((s: SpellRecord) => [s.id, s]))
    expect(byId.get('mages-lucubration')).toMatchObject({ levels: { Wiz: 6 } })
    expect(byId.get('fireball')).toMatchObject({ levels: { Sor: 3, Wiz: 3 } })
  })
  it('has every core class list and the cleric domains', () => {
    const count = (c: ClassCode) => spellsForClass(srd, c).length
    expect([count('Brd'), count('Clr'), count('Drd'), count('Pal'), count('Rgr')]).toEqual([164, 231, 169, 45, 51])
    const byId = new Map(srd.map((s: SpellRecord) => [s.id, s]))
    expect(byId.get('cure-light-wounds')).toMatchObject({ levels: { Brd: 1, Clr: 1, Drd: 1, Pal: 1, Rgr: 2 }, domains: { Healing: 1 } })
    expect(byId.get('dispel-magic')).toMatchObject({ levels: { Brd: 3, Clr: 3, Drd: 4, Sor: 3, Wiz: 3 }, domains: { Magic: 3 } })
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
    expect(JSON.parse(readFileSync('public/data/spells/manifest.json', 'utf8'))).toEqual(['srd.json', 'index-extra.json', 'index-books.json', 'index-special.json', 'kanderra.json'])
  })
})

describe("bundled Kan'Derra spells", () => {
  const kd = JSON.parse(readFileSync('public/data/spells/kanderra.json', 'utf8'))
  const others = new Set(
    ['srd.json', 'index-extra.json', 'index-books.json'].flatMap((f) => JSON.parse(readFileSync(`public/data/spells/${f}`, 'utf8')).map((s: { id: string }) => s.id)),
  )
  it('are valid, have a level somewhere, and override nothing', () => {
    expect(validateSpellFile(kd)).toEqual([])
    expect(kd.filter((s: { levels: object; domains?: object }) => !Object.keys(s.levels).length && !Object.keys(s.domains ?? {}).length)).toEqual([])
    expect(kd.filter((s: { id: string }) => others.has(s.id))).toEqual([])
  })
})

describe('bundled book index', () => {
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
      'Weapons of Legacy', 'Book of Exalted Deeds', 'Spell Compendium', 'Savage Species', 'Book of Vile Darkness', 'SRD',
    ])
    expect(books.filter((s: { source: string }) => !allowed.has(s.source))).toEqual([])
  })
})

describe('bundled corrupt and sanctified spells', () => {
  const special = JSON.parse(readFileSync('public/data/spells/index-special.json', 'utf8'))
  const others = new Set(
    ['srd.json', 'index-extra.json', 'index-books.json', 'kanderra.json'].flatMap((f) => JSON.parse(readFileSync(`public/data/spells/${f}`, 'utf8')).map((s: { id: string }) => s.id)),
  )
  it('are valid, summary only, on every prepared caster list and override nothing', () => {
    expect(validateSpellFile(special)).toEqual([])
    for (const s of special) {
      expect(['Corrupt', 'Sanctified']).toContain(s.special)
      expect(s.description).toMatch(/Summary only\. Full text: Book of (Vile Darkness|Exalted Deeds), p\. \d+\.$/)
      expect(Object.keys(s.levels).sort()).toEqual(expect.arrayContaining(['Clr', 'Drd', 'Wiz']))
      expect(s.levels).not.toHaveProperty('Sor')
    }
    expect(special.filter((s: { id: string }) => others.has(s.id))).toEqual([])
  })
})
