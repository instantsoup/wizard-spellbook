import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { evoker5, S } from '../rules/fixtures'
import { exportBackup, parseBackup, restoreBackup } from './backup'
import {
  addStartingCantrips,
  createCharacter,
  deleteCharacter,
  getActiveCharacterId,
  knownSpellsFor,
  learnSpells,
} from './characters'
import { SpellbookDB } from './db'
import { mergeSpells } from './spells'

let d: SpellbookDB
let n = 0
beforeEach(() => {
  d = new SpellbookDB(`test-${n++}`)
})

const allSpells = Object.values(S)

describe('characters', () => {
  it('creating a character makes it active', async () => {
    const c = await createCharacter({ ...evoker5, name: 'Elminster' }, d)
    expect(await getActiveCharacterId(d)).toBe(c.id)
  })

  it('adds starting cantrips except prohibited schools, once', async () => {
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    await addStartingCantrips(c, allSpells, d)
    await addStartingCantrips(c, allSpells, d)
    const known = await knownSpellsFor(c.id, d)
    expect(known.map((k) => k.spellId).sort()).toEqual(['detect-magic', 'ray-of-frost'])
    expect(known.every((k) => k.method === 'starting-cantrip' && k.costGp === 0)).toBe(true)
  })

  it('learnSpells is all-or-nothing and enforces free-pick limits', async () => {
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    const bad = await learnSpells(
      c,
      [
        { spell: S.magicMissile, req: { method: 'starting-free' } },
        { spell: S.sleep, req: { method: 'starting-free' } }, // prohibited
      ],
      d,
    )
    expect(bad.ok).toBe(false)
    expect(await knownSpellsFor(c.id, d)).toHaveLength(0)

    const good = await learnSpells(
      c,
      [
        { spell: S.fireball, req: { method: 'scroll' } },
        { spell: S.scorchingRay, req: { method: 'levelup-free', freePickLevel: 3 } },
        { spell: S.magicMissile, req: { method: 'levelup-free', freePickLevel: 3 } },
        { spell: S.mageArmor, req: { method: 'levelup-free', freePickLevel: 3 } }, // 3rd pick from level 3
      ],
      d,
    )
    expect(good.ok).toBe(false)
    expect(good.errors[0]).toMatch(/No free picks left from wizard level 3/)
  })

  it('deleting a character removes its spells and picks another active one', async () => {
    const a = await createCharacter({ ...evoker5, name: 'A' }, d)
    const b = await createCharacter({ ...evoker5, name: 'B' }, d)
    await learnSpells(b, [{ spell: S.fireball, req: { method: 'scroll' } }], d)
    await deleteCharacter(b.id, d)
    expect(await knownSpellsFor(b.id, d)).toHaveLength(0)
    expect(await getActiveCharacterId(d)).toBe(a.id)
  })
})

describe('backup', () => {
  it('round-trips all data', async () => {
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    await learnSpells(c, [{ spell: S.fireball, req: { method: 'scroll' } }], d)
    const backup = parseBackup(JSON.stringify(await exportBackup(d)))

    const other = new SpellbookDB(`test-restore-${n++}`)
    await createCharacter({ ...evoker5, name: 'will be replaced' }, other)
    await restoreBackup(backup, other)
    expect((await other.characters.toArray()).map((x) => x.name)).toEqual(['E'])
    expect(await knownSpellsFor(c.id, other)).toHaveLength(1)
    expect(await getActiveCharacterId(other)).toBe(c.id)
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/)
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Wizard/)
    expect(() => parseBackup('{"app":"wizard-spellbook","version":99,"data":{}}')).toThrow(/newer version/)
  })
})

describe('mergeSpells', () => {
  it('lets later lists replace spells by id and sorts by level then name', () => {
    const fixed = { ...S.fireball, name: 'Fireball (fixed)' }
    const merged = mergeSpells([S.fireball, S.magicMissile], [fixed])
    expect(merged.map((s) => s.name)).toEqual(['Magic Missile', 'Fireball (fixed)'])
  })
})

describe('entry edits', () => {
  it('changes only the note; the cost stays fixed', async () => {
    const { updateKnownSpellNote } = await import('./characters')
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    const r = await learnSpells(c, [{ spell: S.fireball, req: { method: 'scroll' }, note: 'x' }], d)
    await updateKnownSpellNote(r.added[0].id, '  From the lich  ', d)
    expect((await knownSpellsFor(c.id, d))[0]).toMatchObject({ costGp: 300, note: 'From the lich' })
    await updateKnownSpellNote(r.added[0].id, '', d)
    expect((await knownSpellsFor(c.id, d))[0].note).toBeUndefined()
  })
})

describe('database upgrade', () => {
  it('v2 strips old table-rule settings from saved wizards', async () => {
    const Dexie = (await import('dexie')).default
    const name = `upgrade-${n++}`
    const v1 = new Dexie(name)
    v1.version(1).stores({ characters: 'id, name', knownSpells: 'id, characterId, spellId, [characterId+spellId]', days: 'id, characterId, [characterId+current]', templates: 'id, characterId', ledger: 'id, characterId', storedSpells: 'id, origin', settings: 'key' })
    await v1.table('characters').add({ ...evoker5, id: 'c1', name: 'Old', houseRules: { gpPerSpellLevel: 50 } })
    v1.close()
    const v2 = new SpellbookDB(name)
    const c = await v2.characters.get('c1')
    expect(c?.name).toBe('Old')
    expect(c).not.toHaveProperty('houseRules')
  })

  it('v3 drops extra costs and manual expenses', async () => {
    const Dexie = (await import('dexie')).default
    const name = `upgrade-${n++}`
    const v2 = new Dexie(name)
    const stores = { characters: 'id, name', knownSpells: 'id, characterId, spellId, [characterId+spellId]', days: 'id, characterId, [characterId+current]', templates: 'id, characterId', ledger: 'id, characterId', storedSpells: 'id, origin', settings: 'key' }
    v2.version(1).stores(stores)
    v2.version(2).stores({})
    await v2.table('knownSpells').add({ id: 'k1', characterId: 'c1', spellId: 'haste', spellLevel: 3, method: 'scroll', costGp: 300, extraCostGp: 375, addedAt: 1 })
    await v2.table('ledger').add({ id: 'l1', characterId: 'c1', label: 'Ink', amountGp: 15, at: 1 })
    v2.close()
    const v3 = new SpellbookDB(name)
    expect(await v3.knownSpells.get('k1')).not.toHaveProperty('extraCostGp')
    expect(await v3.ledger.count()).toBe(0)
  })

  it('restoring an old backup drops retired data', async () => {
    const backup = parseBackup(
      JSON.stringify({
        app: 'wizard-spellbook',
        version: 1,
        exportedAt: '2026-11-01T00:00:00Z',
        data: {
          characters: [{ ...evoker5, id: 'c1', name: 'Old', houseRules: { gpPerSpellLevel: 50 } }],
          knownSpells: [{ id: 'k1', characterId: 'c1', spellId: 'haste', spellLevel: 3, method: 'scroll', costGp: 300, extraCostGp: 375, addedAt: 1 }],
          ledger: [{ id: 'l1', characterId: 'c1', label: 'Ink', amountGp: 15, at: 1 }],
        },
      }),
    )
    await restoreBackup(backup, d)
    expect(await d.characters.get('c1')).not.toHaveProperty('houseRules')
    expect(await d.knownSpells.get('k1')).not.toHaveProperty('extraCostGp')
    expect(await d.ledger.count()).toBe(0)
  })
})

describe('changing prohibited schools', () => {
  it('finds and removes book spells from newly prohibited schools', async () => {
    const { knownSpellsInSchools, updateCharacterAndBook } = await import('./characters')
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    await learnSpells(c, [{ spell: S.haste, req: { method: 'scroll' } }, { spell: S.fireball, req: { method: 'scroll' } }], d)
    const byId = new Map(Object.values(S).map((s) => [s.id, s]))
    const hit = await knownSpellsInSchools(c.id, ['Transmutation', 'Illusion'], byId, d)
    expect(hit.map((k) => k.spellId)).toEqual(['haste'])
    const { ensureCurrentDay, getCurrentDay, saveDaySlots } = await import('./days')
    const day = await ensureCurrentDay(c, d)
    const i = day.slots.findIndex((s) => s.slotLevel === 3 && s.kind === 'base')
    await saveDaySlots(day.id, day.slots.map((s, j) => (j === i ? { ...s, spellId: 'haste' } : s)), d)
    await updateCharacterAndBook(c.id, { prohibited: ['Transmutation', 'Illusion'] }, hit.map((k) => k.id), d)
    expect((await getCurrentDay(c.id, d))!.slots.some((s) => s.spellId === 'haste')).toBe(false)
    expect((await knownSpellsFor(c.id, d)).map((k) => k.spellId)).toEqual(['fireball'])
    expect((await d.characters.get(c.id))?.prohibited).toEqual(['Transmutation', 'Illusion'])
  })
})
