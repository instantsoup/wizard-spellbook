import MiniSearch from 'minisearch'
import type { School, Spell } from '../../data/spell-schema'
import { effectiveInt, isProhibited, maxSpellLevel, minIntForSpellLevel, type WizardCharacter } from '../../rules'

export type ExcludableComponent = 'V' | 'S' | 'M' | 'F' | 'XP'

export interface LibraryFilters {
  query: string
  levels: number[]
  schools: School[]
  notInBook: boolean
  castableNow: boolean
  hideProhibited: boolean
  /** Hide spells that need any of these components. */
  without: ExcludableComponent[]
  sources: string[]
  subschool?: string
  descriptor?: string
}

export const EMPTY_FILTERS: LibraryFilters = {
  query: '',
  levels: [],
  schools: [],
  notInBook: false,
  castableNow: false,
  hideProhibited: false,
  without: [],
  sources: [],
}

export function activeFilterCount(f: LibraryFilters): number {
  return (
    (f.levels.length ? 1 : 0) +
    (f.schools.length ? 1 : 0) +
    (f.notInBook ? 1 : 0) +
    (f.castableNow ? 1 : 0) +
    (f.hideProhibited ? 1 : 0) +
    (f.without.length ? 1 : 0) +
    (f.sources.length ? 1 : 0) +
    (f.subschool ? 1 : 0) +
    (f.descriptor ? 1 : 0)
  )
}

export function buildSearchIndex(spells: Spell[]) {
  const index = new MiniSearch<Spell>({
    fields: ['name', 'summary', 'descriptorText', 'description'],
    storeFields: [],
    extractField: (doc, field) =>
      field === 'descriptorText' ? [doc.subschool, ...doc.descriptors].filter(Boolean).join(' ') : (doc as unknown as Record<string, string>)[field],
    searchOptions: { boost: { name: 5, summary: 2, descriptorText: 2 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
  })
  index.addAll(spells)
  return index
}

/** Applies filters; with a search query, results are ordered by relevance. */
export function filterSpells(
  spells: Spell[],
  f: LibraryFilters,
  ctx: { character: WizardCharacter; knownIds: ReadonlySet<string>; index?: MiniSearch<Spell> },
): Spell[] {
  const { character, knownIds } = ctx
  const castable = maxSpellLevel(character.wizardLevel)
  const int = effectiveInt(character)

  let ordered = spells
  const q = f.query.trim()
  if (q) {
    const index = ctx.index ?? buildSearchIndex(spells)
    const rank = new Map(index.search(q).map((r, i) => [r.id as string, i]))
    // Names starting with the query come first, then by search relevance.
    const lower = q.toLowerCase()
    const starts = (s: Spell) => (s.name.toLowerCase().startsWith(lower) ? 0 : 1)
    ordered = spells
      .filter((s) => rank.has(s.id))
      .sort((a, b) => starts(a) - starts(b) || rank.get(a.id)! - rank.get(b.id)!)
  }

  return ordered.filter(
    (s) =>
      (!f.levels.length || f.levels.includes(s.level)) &&
      (!f.schools.length || f.schools.includes(s.school)) &&
      (!f.notInBook || !knownIds.has(s.id)) &&
      (!f.castableNow || (s.level <= castable && int >= minIntForSpellLevel(s.level))) &&
      (!f.hideProhibited || !isProhibited(character, s.school)) &&
      !f.without.some((c) => s.components.includes(c)) &&
      (!f.sources.length || f.sources.includes(s.source)) &&
      (!f.subschool || s.subschool === f.subschool) &&
      (!f.descriptor || s.descriptors.includes(f.descriptor)),
  )
}

/** Distinct values for the "more filters" pickers. */
export function filterOptions(spells: Spell[]) {
  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort()
  return {
    sources: uniq(spells.map((s) => s.source)),
    subschools: uniq(spells.flatMap((s) => (s.subschool ? s.subschool.split(/,\s*|\s+or\s+/) : []))),
    descriptors: uniq(spells.flatMap((s) => s.descriptors)).filter((d) => !/see text|\bor\b/i.test(d)),
  }
}
