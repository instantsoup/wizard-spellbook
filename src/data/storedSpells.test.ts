import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { S } from '../rules/fixtures'
import { SpellbookDB } from './db'
import { deleteStoredSpell, exportStoredSpells, importSpellFile, saveCustomSpell, uniqueSpellId } from './storedSpells'

let d: SpellbookDB
let n = 0
beforeEach(() => {
  d = new SpellbookDB(`stored-${n++}`)
})

describe('importSpellFile', () => {
  it('imports a valid file and reports replacements on re-import', async () => {
    const text = JSON.stringify([S.fireball, S.haste])
    expect(await importSpellFile(text, d)).toMatchObject({ ok: true, added: 2, replaced: 0 })
    expect(await importSpellFile(text, d)).toMatchObject({ ok: true, added: 0, replaced: 2 })
    expect((await d.storedSpells.toArray()).every((s) => s.origin === 'imported')).toBe(true)
  })
  it('accepts a single spell object', async () => {
    expect(await importSpellFile(JSON.stringify(S.wish), d)).toMatchObject({ ok: true, added: 1 })
  })
  it('rejects invalid files without storing anything', async () => {
    const r = await importSpellFile(JSON.stringify([S.fireball, { ...S.haste, level: 12 }]), d)
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/level/)
    expect(await d.storedSpells.count()).toBe(0)
    expect((await importSpellFile('{oops', d)).errors[0]).toMatch(/Not valid JSON/)
  })
})

describe('custom spells', () => {
  it('validates, saves, exports without the origin field, and deletes', async () => {
    expect(await saveCustomSpell({ ...S.fireball, school: 'Wizardry' as never }, d)).toHaveLength(1)
    expect(await saveCustomSpell({ ...S.fireball, id: 'my-fireball', source: 'Homebrew' }, d)).toEqual([])
    const exported = await exportStoredSpells(d)
    expect(exported).toHaveLength(1)
    expect(exported[0]).not.toHaveProperty('origin')
    await deleteStoredSpell('my-fireball', d)
    expect(await d.storedSpells.count()).toBe(0)
  })
  it('makes unique ids', () => {
    expect(uniqueSpellId('Orb of Fire', new Set())).toBe('orb-of-fire')
    expect(uniqueSpellId('Fireball', new Set(['fireball', 'fireball-2']))).toBe('fireball-3')
  })
})
