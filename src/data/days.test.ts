import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { evoker5 } from '../rules/fixtures'
import { createCharacter, deleteCharacter } from './characters'
import { DAY_HISTORY, ensureCurrentDay, getCurrentDay, saveDaySlots, saveTemplate, startNewDay } from './days'
import { SpellbookDB } from './db'

let d: SpellbookDB
let n = 0
beforeEach(() => {
  d = new SpellbookDB(`days-${n++}`)
})

describe('days', () => {
  it('creates one empty current day on demand', async () => {
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    const a = await ensureCurrentDay(c, d)
    const b = await ensureCurrentDay(c, d)
    expect(a.id).toBe(b.id)
    expect(a.slots).toHaveLength(17)
    expect(a.slots.every((s) => !s.spellId)).toBe(true)
  })

  it('rest keeps spells (clearing casts) or starts empty', async () => {
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    const day = await ensureCurrentDay(c, d)
    const slots = day.slots.map((s, i) => (i === 0 ? { ...s, spellId: 'ray-of-frost', expended: true } : s))
    await saveDaySlots(day.id, slots, d)

    const kept = await startNewDay(c, { keepSpells: true, label: ' Day 2 ' }, d)
    expect(kept.slots[0]).toMatchObject({ spellId: 'ray-of-frost', expended: false })
    expect(kept.label).toBe('Day 2')
    expect((await getCurrentDay(c.id, d))!.id).toBe(kept.id)
    expect(await d.days.where('characterId').equals(c.id).count()).toBe(2)

    const fresh = await startNewDay(c, { keepSpells: false }, d)
    expect(fresh.slots.every((s) => !s.spellId)).toBe(true)
    expect(await d.days.where('[characterId+current]').equals([c.id, 1]).count()).toBe(1)
  })

  it('new day follows a level-up', async () => {
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    await ensureCurrentDay(c, d)
    const next = await startNewDay({ ...c, wizardLevel: 7 }, { keepSpells: true }, d)
    expect(next.slots.some((s) => s.slotLevel === 4)).toBe(true)
  })

  it(`keeps at most ${DAY_HISTORY} days`, async () => {
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    for (let i = 0; i < DAY_HISTORY + 5; i++) await startNewDay(c, { keepSpells: true }, d)
    expect(await d.days.where('characterId').equals(c.id).count()).toBe(DAY_HISTORY)
  })

  it('deleting a character removes its days', async () => {
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    await ensureCurrentDay(c, d)
    await deleteCharacter(c.id, d)
    expect(await d.days.count()).toBe(0)
  })
})

describe('templates', () => {
  it('saves only filled slots and overwrites by name', async () => {
    const c = await createCharacter({ ...evoker5, name: 'E' }, d)
    const day = await ensureCurrentDay(c, d)
    const slots = day.slots.map((s, i) => (i === 0 ? { ...s, spellId: 'ray-of-frost' } : s))
    const t1 = await saveTemplate(c.id, 'Dungeon', slots, d)
    expect(t1.picks).toEqual([{ slotLevel: 0, kind: 'base', spellId: 'ray-of-frost' }])
    const t2 = await saveTemplate(c.id, 'Dungeon', day.slots, d)
    expect(t2.id).toBe(t1.id)
    expect(await d.templates.count()).toBe(1)
  })
})
