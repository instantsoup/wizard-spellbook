import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'
import { SpellbookDB } from './db'

it('upgrades a saved custom-casting modifier to a score', async () => {
  const name = 'migrate-test'
  const old = new Dexie(name)
  old.version(3).stores({
    characters: 'id, name',
    knownSpells: 'id, characterId, spellId, [characterId+spellId]',
    days: 'id, characterId, [characterId+current]',
    templates: 'id, characterId',
    ledger: 'id, characterId',
    storedSpells: 'id, origin',
    settings: 'key',
  })
  await old.table('characters').add({ id: 'c1', name: 'Scholar', customCasting: { bonusSpells: 10, dc: 12 } })
  old.close()

  const db = new SpellbookDB(name)
  expect(await db.characters.get('c1')).toMatchObject({ customCasting: { score: 30, dc: 12 } })
  db.close()
})
