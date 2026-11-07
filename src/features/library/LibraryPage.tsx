import { SchoolIcon } from '../../components/SchoolIcon'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ordinal, SCHOOL_STYLE } from '../../components/schools'
import { SpellRow } from '../../components/SpellCard'
import { Button, Card, Chip, inputClass, Loading, Messages, Page } from '../../components/ui'
import type { CharacterRecord } from '../../data/db'
import { useKnownSpells } from '../../data/hooks'
import { SCHOOLS, type School, type Spell } from '../../data/spell-schema'
import { useSpells } from '../../data/spells'
import { freePickStatus, isProhibited, maxSpellLevel } from '../../rules'
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

export function LibraryPage({ character }: { character: CharacterRecord }) {
  const known = useKnownSpells(character.id)
  const { spells, loading, error } = useSpells()
  const [f, setF] = useState<LibraryFilters>(loadFilters)
  const [showMore, setShowMore] = useState(false)
  const [openId, setOpenId] = useState<string>()
  const [adding, setAdding] = useState<Spell>()
  const [toast, setToast] = useState<string>()
  const [limit, setLimit] = useState(PAGE)

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

  const index = useMemo(() => buildSearchIndex(spells), [spells])
  const options = useMemo(() => filterOptions(spells), [spells])
  const knownIds = useMemo(() => new Set((known ?? []).map((k) => k.spellId)), [known])
  const results = useMemo(() => filterSpells(spells, f, { character, knownIds, index }), [spells, f, character, knownIds, index])

  if (loading || !known) return <Loading what="Opening the library" />
  if (error) return <Page title="Library"><Messages errors={[error]} /></Page>

  const set = (patch: Partial<LibraryFilters>) => {
    setF((prev) => ({ ...prev, ...patch }))
    setLimit(PAGE)
  }
  const castable = maxSpellLevel(character.wizardLevel)
  const picks = freePickStatus(character, known).filter((s) => s.remaining > 0)
  const freeLeft = picks.reduce((n, s) => n + s.remaining, 0)
  const moreCount = (f.without.length ? 1 : 0) + (f.sources.length ? 1 : 0) + (f.subschool ? 1 : 0) + (f.descriptor ? 1 : 0)

  return (
    <Page title="Library" subtitle={`${spells.length} spells`} actions={<Link to="/spells"><Button variant="secondary">My spells</Button></Link>}>
      {freeLeft > 0 && (
        <Card className="mb-3 border-rubric/30 text-sm">
          <p>
            <span className="font-semibold text-rubric">{freeLeft} free spell{freeLeft === 1 ? '' : 's'}</span> to choose. Tap + on a spell to use one.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {picks.map((p) => (
              <li key={p.wizardLevel} className="rounded-full bg-parchment-dark px-2.5 py-1">
                {p.wizardLevel === 1 ? 'Starting' : `Lvl ${p.wizardLevel}`}: {p.remaining} × up to {ordinal(p.maxSpellLevel)}
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
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="Spell level">
        {Array.from({ length: 10 }, (_, l) => (
          <Chip key={l} selected={f.levels.includes(l)} onClick={() => set({ levels: toggle(f.levels, l) })}>
            {l === 0 ? 'Cantrip' : l}
          </Chip>
        ))}
      </div>
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="School">
        {SCHOOLS.map((s) => (
          <Chip key={s} selected={f.schools.includes(s)} color={SCHOOL_STYLE[s].color} onClick={() => set({ schools: toggle(f.schools, s) })}>
            <span className="inline-flex items-center gap-1">
              <SchoolIcon school={s} />
              {SCHOOL_STYLE[s].abbr}
            </span>
          </Chip>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Chip selected={f.notInBook} onClick={() => set({ notInBook: !f.notInBook })}>
          Not in book
        </Chip>
        <Chip selected={f.castableNow} onClick={() => set({ castableNow: !f.castableNow })}>
          Castable now
        </Chip>
        <Chip selected={f.hideProhibited} onClick={() => set({ hideProhibited: !f.hideProhibited })}>
          Hide prohibited
        </Chip>
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
          const inBook = knownIds.has(s.id)
          const prohibited = isProhibited(character, s.school as School)
          const tooHigh = s.level > castable
          return (
            <SpellRow
              key={s.id}
              spell={s}
              open={openId === s.id}
              onToggle={() => setOpenId(openId === s.id ? undefined : s.id)}
              muted={prohibited || (tooHigh && !inBook)}
              aside={
                inBook ? (
                  <span className="w-11 text-center text-xs font-semibold text-leather">✓<br />Book</span>
                ) : prohibited ? (
                  <span className="w-11 text-center text-xs text-ink/60" title="Prohibited school">🔒</span>
                ) : tooHigh ? (
                  <span className="w-11 text-center text-[11px] leading-tight text-ink/60">Level {s.level}</span>
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
      {results.length > limit && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setLimit(limit + PAGE * 2)}>
          Show more ({results.length - limit} left)
        </Button>
      )}
      {results.length === 0 && <p className="py-8 text-center text-ink/60">No spells match.</p>}

      {adding && (
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
