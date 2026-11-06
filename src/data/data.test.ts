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
        { spell: S.fireball, req: { method: 'scroll' }, extraCostGp: 375 },
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

describe('ledger and entry edits', () => {
  it('adds and deletes manual entries; edits a book entry', async () => {
    const { addLedgerEntry, deleteLedgerEntry, updateKnownSpell } = await import('./characters')
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    await addLedgerEntry(c.id, 'Ink', 15, d)
    const [entry] = await d.ledger.toArray()
    expect(entry).toMatchObject({ label: 'Ink', amountGp: 15, characterId: c.id })
    await deleteLedgerEntry(entry.id, d)
    expect(await d.ledger.count()).toBe(0)

    const r = await learnSpells(c, [{ spell: S.fireball, req: { method: 'scroll' }, extraCostGp: 50, note: 'x' }], d)
    await updateKnownSpell(r.added[0].id, { costGp: 250, extraCostGp: 0, note: '' }, d)
    const k = (await knownSpellsFor(c.id, d))[0]
    expect(k.costGp).toBe(250)
    expect(k.extraCostGp).toBeUndefined()
    expect(k.note).toBeUndefined()
  })
})
