import { SchoolIcon } from '../../components/SchoolIcon'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { gp, METHOD_LABEL } from '../../components/labels'
import { levelLabel, ordinal, SCHOOL_STYLE } from '../../components/schools'
import { SpellRow } from '../../components/SpellCard'
import { Button, Card, Chip, inputClass, Loading, Page } from '../../components/ui'
import type { CharacterRecord, KnownSpellRecord } from '../../data/db'
import { useKnownSpells, useLedger } from '../../data/hooks'
import { SCHOOLS, type School, type Spell } from '../../data/spell-schema'
import { useSpells } from '../../data/spells'
import { freePickStatus, ledgerSummary } from '../../rules'
import { EditEntrySheet } from './EditEntrySheet'
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
  const ledger = useLedger(character.id)
  const { byId, loading } = useSpells()
  const [groupBy, setGroupByState] = useState<GroupBy>(loadGroup)
  const [filter, setFilter] = useState<number | School>()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string>()
  const [editing, setEditing] = useState<KnownSpellRecord>()
  const [showPicks, setShowPicks] = useState(false)

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
      .map((k) => ({ k, spell: byId.get(k.spellId) }))
      .filter((e): e is { k: KnownSpellRecord; spell: Spell } => !!e.spell && (!q || e.spell.name.toLowerCase().includes(q)))
      .sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name))
  }, [known, byId, query])

  if (!known || !ledger || loading) return <Loading />

  const groupOf = (s: Spell): number | School => (groupBy === 'level' ? s.level : s.school)
  const groups: (number | School)[] =
    groupBy === 'level'
      ? [...new Set(entries.map((e) => e.spell.level))]
      : SCHOOLS.filter((s) => entries.some((e) => e.spell.school === s))
  const picks = freePickStatus(character, known)
  const freeLeft = picks.reduce((n, p) => n + p.remaining, 0)
  const freeGranted = picks.reduce((n, p) => n + p.granted, 0)
  const startingLeft = picks.find((p) => p.wizardLevel === 1)?.remaining ?? 0
  const summary = ledgerSummary(known, ledger)
  const missing = known.filter((k) => !byId.has(k.spellId))

  return (
    <Page
      title={character.name}
      subtitle={
        <>
          Wizard {character.wizardLevel}
          {character.specialty ? ` · ${character.specialty} specialist` : ''} · {known.length} spells ·{' '}
          <Link to="/ledger" className="underline decoration-ink/30 underline-offset-2">
            {gp(summary.total)} spent
          </Link>
        </>
      }
    >
      <Reminders hasSpells={known.length > 0} />
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

      {known.length > 0 && (
        <>
          <input className={`${inputClass} mb-2`} type="search" placeholder="Search your book" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm text-ink/60">Group by</span>
            <Chip selected={groupBy === 'level'} onClick={() => setGroupBy('level')}>
              Level
            </Chip>
            <Chip selected={groupBy === 'school'} onClick={() => setGroupBy('school')}>
              School
            </Chip>
          </div>
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
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
                  <span className="inline-flex items-center gap-1">
                    <SchoolIcon school={g} />
                    {SCHOOL_STYLE[g].abbr}
                  </span>
                ) : g === 0 ? (
                  'Cantrips'
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
                  <span className="inline-flex items-center gap-2">
                    <SchoolIcon school={g} className="size-5" />
                    {g}
                  </span>
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
                        {k.costGp + (k.extraCostGp ?? 0) ? gp(k.costGp + (k.extraCostGp ?? 0)) : 'free'}
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
      {missing.length > 0 && (
        <p className="mt-4 text-xs text-rubric">
          {missing.length} spell(s) in your book are missing from the spell database: {missing.map((m) => m.spellId).join(', ')}.
        </p>
      )}
      {editing && <EditEntrySheet entry={editing} name={byId.get(editing.spellId)?.name ?? editing.spellId} onClose={() => setEditing(undefined)} />}
    </Page>
  )
}
