import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { gp, METHOD_LABEL } from '../../components/labels'
import { levelLabel, ordinal, SCHOOL_STYLE } from '../../components/schools'
import { SpellRow } from '../../components/SpellCard'
import { Button, Card, Chip, inputClass, Loading, Page } from '../../components/ui'
import { addNewCantrips } from '../../data/characters'
import type { CharacterRecord, KnownSpellRecord } from '../../data/db'
import { useBooks, useKnownSpells } from '../../data/hooks'
import { SCHOOLS, type School, type Spell } from '../../data/spell-schema'
import { useSpells } from '../../data/spells'
import { entryCost, freePickStatus, isProhibited, ledgerSummary } from '../../rules'
import { BooksSheet, bookCapacity, bookPages } from './BooksSheet'
import { EditEntrySheet } from './EditEntrySheet'
import { loadSelectedBook, pickBook, saveSelectedBook } from './selectedBook'
import { Reminders } from './Reminders'

type GroupBy = 'level' | 'school'
const GROUP_KEY = 'bookGroupBy'
const loadGroup = (): GroupBy => {
  try {
    return localStorage.getItem(GROUP_KEY) === 'school' ? 'school' : 'level'
  } catch {
    return 'level'
  }
}

export function BookPage({ character }: { character: CharacterRecord }) {
  const known = useKnownSpells(character.id)
  const books = useBooks(character.id)
  const { spells, byId, loading } = useSpells()
  const [bookId, setBookIdState] = useState(() => loadSelectedBook(character.id))
  const [managing, setManaging] = useState(false)
  const book = books ? pickBook(books, bookId) : undefined
  const setBookId = (id: string) => {
    setBookIdState(id)
    setFilter(undefined)
    saveSelectedBook(character.id, id)
  }
  const [groupBy, setGroupByState] = useState<GroupBy>(loadGroup)
  const [filter, setFilter] = useState<number | School>()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string>()
  const [editing, setEditing] = useState<KnownSpellRecord>()
  const [showPicks, setShowPicks] = useState(false)

  // Cantrips from books added since this character was made arrive once.
  useEffect(() => {
    if (!loading && spells.length && known) void addNewCantrips(character, spells)
  }, [loading, spells, known, character])

  const setGroupBy = (g: GroupBy) => {
    setGroupByState(g)
    setFilter(undefined)
    try {
      localStorage.setItem(GROUP_KEY, g)
    } catch {
      /* not remembered */
    }
  }

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (known ?? [])
      .filter((k) => !book || k.bookId === book.id)
      .map((k) => ({ k, spell: byId.get(k.spellId) }))
      .filter(
        (e): e is { k: KnownSpellRecord; spell: Spell } =>
          !!e.spell && !isProhibited(character, e.spell.school) && (!q || e.spell.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name))
  }, [known, byId, query, character, book])

  if (!known || !books || !book || loading) return <Loading />

  const groupOf = (s: Spell): number | School => (groupBy === 'level' ? s.level : s.school)
  const groups: (number | School)[] =
    groupBy === 'level'
      ? [...new Set(entries.map((e) => e.spell.level))]
      : SCHOOLS.filter((s) => entries.some((e) => e.spell.school === s))
  const picks = freePickStatus(character, known)
  const freeLeft = picks.reduce((n, p) => n + p.remaining, 0)
  const freeGranted = picks.reduce((n, p) => n + p.granted, 0)
  const startingLeft = picks.find((p) => p.wizardLevel === 1)?.remaining ?? 0
  const summary = ledgerSummary(known)
  const missing = known.filter((k) => !byId.has(k.spellId))
  const uniqueSpells = new Set(known.map((k) => k.spellId)).size
  const inBook = known.filter((k) => k.bookId === book.id)
  const pages = bookPages(book, known)
  const capacity = bookCapacity(book)

  return (
    <Page
      title={character.name}
      subtitle={
        <>
          Wizard {character.wizardLevel}
          {character.specialty ? ` · ${character.specialty} specialist` : ''} · {uniqueSpells} spells ·{' '}
          <Link to="/ledger" className="underline decoration-ink/30 underline-offset-2">
            {gp(summary.total)} spent
          </Link>
        </>
      }
    >
      <Reminders hasSpells={known.length > 0} />
      <div className="mb-3">
        <div className="mb-1 flex flex-wrap items-center gap-1.5" aria-label="Spellbooks">
          {books.length > 1 &&
            books.map((b) => (
              <Chip key={b.id} selected={b.id === book.id} onClick={() => setBookId(b.id)}>
                {b.name}
              </Chip>
            ))}
          <Button variant="ghost" className="text-sm" onClick={() => setManaging(true)}>
            {books.length > 1 ? 'Manage books' : 'Add a spellbook'}
          </Button>
        </div>
        <p className={`text-xs ${pages > capacity ? 'text-rubric' : 'text-ink/60'}`}>
          {book.name}
          {book.boccobs ? " · Boccob's blessed book" : ''} · {inBook.length} spell{inBook.length === 1 ? '' : 's'} · {pages}/{capacity} pages
          {pages > capacity ? ' (over the limit)' : ''}
        </p>
      </div>
      <Card className={`mb-4 ${freeLeft ? 'border-rubric/30' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="min-h-11 flex-1 text-left text-sm" onClick={() => setShowPicks(!showPicks)} aria-expanded={showPicks}>
            {freeLeft ? (
              <>
                <span className="font-semibold text-rubric">{freeLeft} free spell{freeLeft === 1 ? '' : 's'}</span> to choose
              </>
            ) : (
              'All free spells chosen'
            )}
            <span className="text-ink/60">
              {' '}
              · {freeGranted - freeLeft}/{freeGranted} used {showPicks ? '▴' : '▾'}
            </span>
          </button>
          {freeLeft > 0 && (
            <Link to={startingLeft > 0 ? '/setup/spells' : '/library'}>
              <Button variant="secondary">Choose</Button>
            </Link>
          )}
        </div>
        {showPicks && (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink/60">
                <th className="font-normal">Granted at</th>
                <th className="font-normal">Up to</th>
                <th className="text-right font-normal">Used</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((p) => (
                <tr key={p.wizardLevel} className={p.remaining ? 'text-rubric' : ''}>
                  <td>{p.wizardLevel === 1 ? 'Start (level 1)' : `Level ${p.wizardLevel}`}</td>
                  <td>{ordinal(p.maxSpellLevel)}-level</td>
                  <td className="text-right">
                    {p.used}/{p.granted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {inBook.length > 0 && (
        <>
          <input className={`${inputClass} mb-2`} type="search" placeholder="Search this book" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm text-ink/60">Group by</span>
            <Chip selected={groupBy === 'level'} onClick={() => setGroupBy('level')}>
              Level
            </Chip>
            <Chip selected={groupBy === 'school'} onClick={() => setGroupBy('school')}>
              School
            </Chip>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Chip selected={filter === undefined} onClick={() => setFilter(undefined)}>
              All
            </Chip>
            {groups.map((g) => (
              <Chip
                key={g}
                selected={filter === g}
                color={typeof g === 'string' ? SCHOOL_STYLE[g].color : undefined}
                onClick={() => setFilter(filter === g ? undefined : g)}
              >
                {typeof g === 'string' ? (
                  SCHOOL_STYLE[g].abbr
                ) : (
                  g
                )}
              </Chip>
            ))}
          </div>
        </>
      )}

      {groups
        .filter((g) => filter === undefined || g === filter)
        .map((g) => {
          const inGroup = entries.filter((e) => groupOf(e.spell) === g)
          return (
            <section key={g} className="mb-4">
              <h2
                className="mb-1 flex items-baseline justify-between border-b border-leather/30 font-display text-lg"
                style={{ color: typeof g === 'string' ? SCHOOL_STYLE[g].color : 'var(--color-leather)' }}
              >
                {typeof g === 'string' ? (
                  g
                ) : (
                  levelLabel(g)
                )}
                <span className="font-body text-xs text-ink/50">{inGroup.length}</span>
              </h2>
              <ul>
                {inGroup.map(({ k, spell }) => (
                  <SpellRow
                    key={k.id}
                    spell={spell}
                    open={openId === k.id}
                    onToggle={() => setOpenId(openId === k.id ? undefined : k.id)}
                    aside={groupBy === 'school' ? <span className="w-8 text-center font-display text-ink/50">{spell.level}</span> : undefined}
                  >
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-parchment-dark/60 px-3 py-1.5 text-xs text-ink/70">
                      <span>
                        {METHOD_LABEL[k.method]}
                        {k.freePickLevel && k.method === 'levelup-free' ? ` (level ${k.freePickLevel})` : ''} ·{' '}
                        {entryCost(k) ? gp(entryCost(k)) : 'free'}
                        {k.scrollCostGp ? ` (${gp(k.costGp)} scribing + ${gp(k.scrollCostGp)} scroll)` : ''}
                        {k.note ? ` · ${k.note}` : ''}
                      </span>
                      <button type="button" className="min-h-9 shrink-0 px-2 text-sm text-leather underline" onClick={() => setEditing(k)}>
                        Edit
                      </button>
                    </div>
                  </SpellRow>
                ))}
              </ul>
            </section>
          )
        })}

      {known.length === 0 && (
        <Card className="text-center">
          <p className="mb-3">Your book is empty.</p>
          <Link to="/setup/spells">
            <Button>Add starting spells</Button>
          </Link>
        </Card>
      )}
      {known.length > 0 && inBook.length === 0 && (
        <Card className="text-center text-sm">
          <p>This book is empty. Add spells from the Library, or copy one from another book (tap a spell, then Edit).</p>
        </Card>
      )}
      {missing.length > 0 && (
        <p className="mt-4 text-xs text-rubric">
          {missing.length} spell(s) in your book are missing from the spell database: {missing.map((m) => m.spellId).join(', ')}.
        </p>
      )}
      {editing && (
        <EditEntrySheet
          character={character}
          entry={editing}
          spell={byId.get(editing.spellId)}
          name={byId.get(editing.spellId)?.name ?? editing.spellId}
          books={books}
          known={known}
          onClose={() => setEditing(undefined)}
        />
      )}
      {managing && (
        <BooksSheet
          characterId={character.id}
          books={books}
          known={known}
          onClose={() => setManaging(false)}
          onAdded={(b) => setBookId(b.id)}
        />
      )}
    </Page>
  )
}
