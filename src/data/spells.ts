// Loads the bundled spell files (manifest order) and merges spells stored on the
// device (imported / custom). Later entries with the same id replace earlier ones.

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from './db'
import { spellsForClass, validateSpellFile, type ClassCode, type Spell, type SpellRecord } from './spell-schema'

const base = () => `${import.meta.env.BASE_URL}data/spells/`

export async function fetchBundledSpells(fetcher: typeof fetch = fetch): Promise<SpellRecord[]> {
  const res = await fetcher(`${base()}manifest.json`)
  if (!res.ok) throw new Error(`Could not load spell list (${res.status}).`)
  const files = (await res.json()) as string[]
  const lists = await Promise.all(
    files.map(async (file) => {
      const r = await fetcher(`${base()}${file}`)
      if (!r.ok) throw new Error(`Could not load ${file} (${r.status}).`)
      const data = await r.json()
      const errors = validateSpellFile(data)
      if (errors.length) console.warn(`${file} has problems:`, errors)
      return data as SpellRecord[]
    }),
  )
  return lists.flat()
}

/** Merges spell files by id (later lists win) and keeps the spells on one class list. */
export function mergeSpells(cls: ClassCode, ...lists: SpellRecord[][]): Spell[] {
  const byId = new Map<string, SpellRecord>()
  for (const list of lists) for (const s of list) byId.set(s.id, s)
  return spellsForClass([...byId.values()], cls).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

let bundledPromise: Promise<SpellRecord[]> | undefined
const loadBundled = () => (bundledPromise ??= fetchBundledSpells())

export interface SpellData {
  spells: Spell[]
  byId: Map<string, Spell>
  loading: boolean
  error?: string
}

/** Spells on one class list (the wizard's Sor/Wiz list by default). */
export function useSpells(cls: ClassCode = 'Wiz'): SpellData {
  const [bundled, setBundled] = useState<SpellRecord[]>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    loadBundled()
      .then((s) => live && setBundled(s))
      .catch((e: Error) => {
        bundledPromise = undefined
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [])
  const stored = useLiveQuery(() => db.storedSpells.toArray(), [])
  return useMemo(() => {
    const spells = bundled ? mergeSpells(cls, bundled, (stored ?? []).map(({ origin: _o, ...s }) => s)) : []
    return { spells, byId: new Map(spells.map((s) => [s.id, s])), loading: !bundled && !error, error }
  }, [bundled, stored, error, cls])
}
