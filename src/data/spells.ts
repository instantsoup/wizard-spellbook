// Loads the bundled spell files (manifest order) and merges spells stored on the
// device (imported / custom). Later entries with the same id replace earlier ones.

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from './db'
import { validateSpellFile, type Spell } from './spell-schema'

const base = () => `${import.meta.env.BASE_URL}data/spells/`

export async function fetchBundledSpells(fetcher: typeof fetch = fetch): Promise<Spell[]> {
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
      return data as Spell[]
    }),
  )
  return lists.flat()
}

export function mergeSpells(...lists: Spell[][]): Spell[] {
  const byId = new Map<string, Spell>()
  for (const list of lists) for (const s of list) byId.set(s.id, s)
  return [...byId.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

let bundledPromise: Promise<Spell[]> | undefined
const loadBundled = () => (bundledPromise ??= fetchBundledSpells())

export interface SpellData {
  spells: Spell[]
  byId: Map<string, Spell>
  loading: boolean
  error?: string
}

export function useSpells(): SpellData {
  const [bundled, setBundled] = useState<Spell[]>()
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
    const spells = bundled ? mergeSpells(bundled, (stored ?? []).map(({ origin: _o, ...s }) => s)) : []
    return { spells, byId: new Map(spells.map((s) => [s.id, s])), loading: !bundled && !error, error }
  }, [bundled, stored, error])
}
