import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ordinal, SCHOOL_STYLE } from '../../components/schools'
import { SpellRow } from '../../components/SpellCard'
import { Button, Card, Chip, inputClass, Loading, Messages, Page } from '../../components/ui'
import type { CharacterRecord } from '../../data/db'
import { useBooks, useKnownSpells } from '../../data/hooks'
import { CLASS_NAMES, SCHOOLS, type ClassCode, type School, type Spell, type SpellList } from '../../data/spell-schema'
import { useSpells } from '../../data/spells'
import { alignmentBar, casterLevel, freePickStatus, isProhibited, maxSpellLevel } from '../../rules'
import { AddToBookSheet } from './AddToBookSheet'
import {
  activeFilterCount,
  buildSearchIndex,
  EMPTY_FILTERS,
  filterOptions,
  filterSpells,
  type ExcludableComponent,
  type LibraryFilters,
} from './filters'

const STORAGE_KEY = 'libraryFilters'
const loadFilters = (): LibraryFilters => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...EMPTY_FILTERS, ...JSON.parse(saved), query: '' } : EMPTY_FILTERS
  } catch {
    return EMPTY_FILTERS
  }
}
const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])
const PAGE = 60

// Class lists to browse without a character. "Wiz" is the sorcerer/wizard list.
const BROWSE_LISTS: { value: SpellList; label: string }[] = [
  { value: 'all', label: 'All classes' },
  ...(['Wiz', 'Clr', 'Drd', 'Brd', 'Pal', 'Rgr'] as ClassCode[]).map((c) => ({ value: c, label: c === 'Wiz' ? 'Sor/Wiz' : CLASS_NAMES[c] })),
]
const LIST_KEY = 'libraryList'
const loadList = (): SpellList => {
  try {
    const v = localStorage.getItem(LIST_KEY) as SpellList | null
    return v && BROWSE_LISTS.some((l) => l.value === v) ? v : 'all'
  } catch {
    return 'all'
  }
}

/** The searchable spell library. Without a character it is for browsing every class list. */
export function LibraryPage({ character }: { character?: CharacterRecord }) {
  const known = useKnownSpells(character?.id)
  const books = useBooks(character?.id)
  const [browseList, setBrowseList] = useState<SpellList>(loadList)
  const list: SpellList = character ? 'Wiz' : browseList
  const { spells, loading, error } = useSpells(list)
  const [f, setF] = useState<LibraryFilters>(loadFilters)
  const [showMore, setShowMore] = useState(false)
  const [openId, setOpenId] = useState<string>()
  const [adding, setAdding] = useState<Spell>()
  const [toast, setToast] = useState<string>()
  const [limit, setLimit] = useState(PAGE)
  // Rows are drawn a page at a time (drawing all ~2,400 makes every filter tap slow on a
  // phone); more load as the end of the list scrolls near.
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...f, query: '' }))
    } catch {
      /* storage unavailable: filters just won't be remembered */
    }
  }, [f])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(undefined), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    try {
      localStorage.setItem(LIST_KEY, browseList)
    } catch {
      /* not remembered */
    }
  }, [browseList])

  const prohibited = (s: School) => !!character && isProhibited(character, s)
  // Spells the character can never cast (prohibited schools; sanctified spells for evil
  // characters) never appear anywhere in the Library.
  const available = useMemo(
    () => spells.filter((s) => !(character && (isProhibited(character, s.school) || alignmentBar(character, s)))),
    [spells, character],
  )
  const index = useMemo(() => buildSearchIndex(available), [available])
  const options = useMemo(() => filterOptions(available), [available])
  const knownIds = useMemo(() => new Set((known ?? []).map((k) => k.spellId)), [known])
  const results = useMemo(
    () => filterSpells(spells, f, { character, knownIds, index, anyLevel: list === 'all' }),
    [spells, f, character, knownIds, index, list],
  )

  const hasMore = results.length > limit
  useEffect(() => {
    const el = moreRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE * 2)
    }, { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, limit])

  if (loading || !known) return <Loading what="Opening the library" />
  if (error) return <Page title="Library"><Messages errors={[error]} /></Page>

  const set = (patch: Partial<LibraryFilters>) => {
    setF((prev) => ({ ...prev, ...patch }))
    setLimit(PAGE)
  }
  const castable = character ? maxSpellLevel(casterLevel(character)) : 9
  const picks = character ? freePickStatus(character, known).filter((s) => s.remaining > 0) : []
  const freeLeft = picks.reduce((n, s) => n + s.remaining, 0)
  // Group picks by the highest spell level they can take.
  const byMax = [...picks.reduce((m, p) => m.set(p.maxSpellLevel, (m.get(p.maxSpellLevel) ?? 0) + p.remaining), new Map<number, number>())].sort(
    (a, b) => a[0] - b[0],
  )
  const moreCount = (f.without.length ? 1 : 0) + (f.sources.length ? 1 : 0) + (f.subschool ? 1 : 0) + (f.descriptor ? 1 : 0)

  return (
    <Page
      title="Library"
      subtitle={character ? `${available.length} spells you can learn from` : `${available.length} spells`}
    >
      {!character && (
        <>
          <Card className="mb-3 flex items-center justify-between gap-3 text-sm">
            <p>Browsing every spell. Create a character to keep a spellbook.</p>
            <Link to="/setup" className="shrink-0">
              <Button>Create</Button>
            </Link>
          </Card>
          <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Class list">
            {BROWSE_LISTS.map((l) => (
              <Chip
                key={l.value}
                selected={browseList === l.value}
                onClick={() => {
                  setBrowseList(l.value)
                  setLimit(PAGE)
                }}
              >
                {l.label}
              </Chip>
            ))}
          </div>
        </>
      )}
      {freeLeft > 0 && (
        <Card className="mb-3 border-rubric/30 text-sm">
          <p>
            <span className="font-semibold text-rubric">{freeLeft} free spell{freeLeft === 1 ? '' : 's'}</span> to choose. Tap + on a spell to use one.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {byMax.map(([max, count]) => (
              <li key={max} className="rounded-full bg-parchment-dark px-2.5 py-1">
                {count} × up to {ordinal(max)}-level
              </li>
            ))}
          </ul>
        </Card>
      )}

      <input
        className={`${inputClass} mb-2`}
        type="search"
        placeholder="Search names and text"
        value={f.query}
        onChange={(e) => set({ query: e.target.value })}
      />
      <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Spell level">
        {Array.from({ length: 10 }, (_, l) => (
          <Chip key={l} selected={f.levels.includes(l)} onClick={() => set({ levels: toggle(f.levels, l) })}>
            {l}
          </Chip>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5" aria-label="School">
        {SCHOOLS.filter((s) => !prohibited(s)).map((s) => (
          <Chip key={s} selected={f.schools.includes(s)} color={SCHOOL_STYLE[s].color} onClick={() => set({ schools: toggle(f.schools, s) })}>
            {SCHOOL_STYLE[s].abbr}
          </Chip>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {character && (
          <>
            <Chip selected={f.notInBook} onClick={() => set({ notInBook: !f.notInBook })}>
              Not in book
            </Chip>
            <Chip selected={f.castableNow} onClick={() => set({ castableNow: !f.castableNow })}>
              Castable now
            </Chip>
          </>
        )}
        <Chip selected={showMore || moreCount > 0} onClick={() => setShowMore(!showMore)}>
          More{moreCount ? ` (${moreCount})` : ''} {showMore ? '▴' : '▾'}
        </Chip>
      </div>

      {showMore && (
        <Card className="mb-3 space-y-3 text-sm">
          <div>
            <p className="mb-1 font-semibold text-ink/80">Without component</p>
            <div className="flex flex-wrap gap-1.5">
              {(['V', 'S', 'M', 'F', 'XP'] as ExcludableComponent[]).map((c) => (
                <Chip key={c} selected={f.without.includes(c)} onClick={() => set({ without: toggle(f.without, c) })}>
                  No {c}
                </Chip>
              ))}
            </div>
          </div>
          {options.sources.length > 1 && (
            <div>
              <p className="mb-1 font-semibold text-ink/80">Source</p>
              <div className="flex flex-wrap gap-1.5">
                {options.sources.map((s) => (
                  <Chip key={s} selected={f.sources.includes(s)} onClick={() => set({ sources: toggle(f.sources, s) })}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <select aria-label="Subschool" className={inputClass} value={f.subschool ?? ''} onChange={(e) => set({ subschool: e.target.value || undefined })}>
              <option value="">Any subschool</option>
              {options.subschools.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select aria-label="Descriptor" className={inputClass} value={f.descriptor ?? ''} onChange={(e) => set({ descriptor: e.target.value || undefined })}>
              <option value="">Any descriptor</option>
              {options.descriptors.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </Card>
      )}

      <div className="mb-1 flex items-center justify-between text-sm text-ink/60">
        <span>
          {results.length} spell{results.length === 1 ? '' : 's'}
        </span>
        {activeFilterCount(f) + (f.query ? 1 : 0) > 0 && (
          <button type="button" className="min-h-9 text-leather underline" onClick={() => {
              setF(EMPTY_FILTERS)
              setLimit(PAGE)
            }}>
            Clear filters
          </button>
        )}
      </div>

      <ul>
        {results.slice(0, limit).map((s) => {
          // ✓ once it is in every book; with several books, + stays until it is in all of them.
          const bookCount = known?.filter((k) => k.spellId === s.id).length ?? 0
          const inBook = knownIds.has(s.id) && bookCount >= Math.max(1, books?.length ?? 1)
          const tooHigh = s.level > castable
          if (!character) {
            return (
              <SpellRow
                key={s.id}
                spell={s}
                open={openId === s.id}
                onToggle={() => setOpenId(openId === s.id ? undefined : s.id)}
                showLevel={list !== 'all'}
              />
            )
          }
          return (
            <SpellRow
              key={s.id}
              spell={s}
              open={openId === s.id}
              onToggle={() => setOpenId(openId === s.id ? undefined : s.id)}
              muted={tooHigh && !inBook}
              aside={
                inBook ? (
                  <span className="w-11 text-center text-xs font-semibold text-leather">✓<br />Book</span>
                ) : tooHigh ? (
                  <span className="w-11 text-center text-[11px] leading-tight text-ink/60">Not yet</span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Add ${s.name}`}
                    onClick={() => {
                      setToast(undefined)
                      setAdding(s)
                    }}
                    className="size-11 rounded-full border-2 border-leather/50 text-xl text-leather active:bg-leather active:text-parchment"
                  >
                    +
                  </button>
                )
              }
            />
          )
        })}
      </ul>
      {hasMore && (
        <div ref={moreRef} className="py-4 text-center text-sm text-ink/50" aria-live="polite">
          Loading more spells…
        </div>
      )}
      {results.length === 0 && <p className="py-8 text-center text-ink/60">No spells match.</p>}

      {adding && character && (
        <AddToBookSheet
          character={character}
          spell={adding}
          known={known}
          onClose={() => setAdding(undefined)}
          onAdded={(msg) => {
            setAdding(undefined)
            setToast(msg)
          }}
        />
      )}
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto max-w-md rounded-lg bg-leather px-4 py-3 text-center text-parchment shadow-lg">
          {toast}
        </div>
      )}
    </Page>
  )
}
