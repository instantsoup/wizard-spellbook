import { useLiveQuery } from 'dexie-react-hooks'
import { ACTIVE_CHARACTER_KEY } from './characters'
import { db, type CharacterRecord, type KnownSpellRecord } from './db'

/** undefined while loading, null when there is no character yet. */
export function useActiveCharacter(): CharacterRecord | null | undefined {
  return useLiveQuery(async () => {
    const id = (await db.settings.get(ACTIVE_CHARACTER_KEY))?.value as string | undefined
    if (id) {
      const c = await db.characters.get(id)
      if (c) return c
    }
    return (await db.characters.toCollection().first()) ?? null
  }, [])
}

export function useCharacters(): CharacterRecord[] | undefined {
  return useLiveQuery(() => db.characters.orderBy('name').toArray(), [])
}

export function useKnownSpells(characterId: string | undefined): KnownSpellRecord[] | undefined {
  return useLiveQuery(
    () => (characterId ? db.knownSpells.where('characterId').equals(characterId).toArray() : []),
    [characterId],
  )
}

export function useSetting<T>(key: string): T | undefined {
  return useLiveQuery(async () => (await db.settings.get(key))?.value as T | undefined, [key])
}

/** undefined while loading, null when the character has no current day yet. */
export function useCurrentDay(characterId: string | undefined) {
  return useLiveQuery(
    async () => (characterId ? ((await db.days.where('[characterId+current]').equals([characterId, 1]).first()) ?? null) : null),
    [characterId],
  )
}

export function useTemplates(characterId: string | undefined) {
  return useLiveQuery(
    () => (characterId ? db.templates.where('characterId').equals(characterId).sortBy('name') : []),
    [characterId],
  )
}
