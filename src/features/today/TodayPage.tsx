import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { levelLabel, SCHOOL_STYLE } from '../../components/schools'
import { Sheet } from '../../components/Sheet'
import { SpellDetails } from '../../components/SpellCard'
import { Button, Card, Loading, Page } from '../../components/ui'
import { saveDaySlots } from '../../data/days'
import type { CharacterRecord } from '../../data/db'
import { useSpells } from '../../data/spells'
import { castGroups, castOne, dayUsage, restoreOne, type CastGroup } from '../../rules'
import { dayTitle, RestSheet, useDay, useWakeLock } from '../prepare/shared'

export function TodayPage({ character }: { character: CharacterRecord }) {
  const day = useDay(character)
  const { byId, loading } = useSpells()
  const [details, setDetails] = useState<CastGroup>()
  const [resting, setResting] = useState(false)
  const [undo, setUndo] = useState<{ index: number; name: string }>()
  useWakeLock()

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(undefined), 5000)
    return () => clearTimeout(t)
  }, [undo])

  if (!day || loading) return <Loading />

  const groups = castGroups(day.slots)
  const usage = dayUsage(day.slots)
  const remaining = usage.reduce((n, u) => n + u.remaining, 0)
  const prepared = usage.reduce((n, u) => n + u.prepared, 0)
  const open = usage.reduce((n, u) => n + u.open, 0)
  const nameOf = (g: CastGroup) => byId.get(g.spellId)?.name ?? g.spellId

  const cast = async (g: CastGroup) => {
    const r = castOne(day.slots, g)
    if (r.index < 0) return
    await saveDaySlots(day.id, r.slots)
    setUndo({ index: r.index, name: nameOf(g) })
  }
  const restore = async (g: CastGroup) => {
    const r = restoreOne(day.slots, g)
    if (r.index >= 0) await saveDaySlots(day.id, r.slots)
  }

  return (
    <Page
      title="Today"
      subtitle={`${dayTitle(day)} · ${remaining} of ${prepared} spells left`}
      actions={<Button onClick={() => setResting(true)}>Rest</Button>}
    >
      {prepared === 0 ? (
        <Card className="text-center">
          <p className="mb-3">No spells prepared yet.</p>
          <Link to="/prepare">
            <Button>Prepare spells</Button>
          </Link>
        </Card>
      ) : (
        usage
          .filter((u) => u.prepared > 0)
          .map((u) => (
            <section key={u.spellLevel} className="mb-5">
              <div className="mb-2 flex items-baseline justify-between border-b border-leather/30">
                <h2 className="font-display text-lg text-leather">{levelLabel(u.spellLevel)}</h2>
                <span className={`text-sm ${u.remaining ? 'text-ink/70' : 'text-rubric'}`}>
                  {u.remaining} of {u.prepared} left
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                {groups
                  .filter((g) => g.slotLevel === u.spellLevel)
                  .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
                  .map((g) => {
                    const spell = byId.get(g.spellId)
                    const color = spell ? SCHOOL_STYLE[spell.school].color : 'var(--color-ink)'
                    const spent = g.remaining === 0
                    return (
                      <li key={`${g.slotLevel}:${g.spellId}`} className="flex overflow-hidden rounded-xl border border-ink/15 bg-surface/50 shadow-sm">
                        <button
                          type="button"
                          disabled={spent}
                          onClick={() => cast(g)}
                          aria-label={`Cast ${nameOf(g)}, ${g.remaining} left`}
                          className="flex min-h-16 flex-1 items-center gap-3 px-3 text-left active:bg-parchment-dark disabled:bg-ink/5"
                        >
                          <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: spent ? 'transparent' : color }} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate font-semibold ${spent ? 'text-ink/40 line-through' : ''}`}>{nameOf(g)}</span>
                            <span className="mt-1 flex gap-1" aria-hidden>
                              {g.slotIndexes.map((i) => (
                                <span
                                  key={i}
                                  className="size-3 rounded-full border-2"
                                  style={{ borderColor: color, backgroundColor: day.slots[i].expended ? 'transparent' : color }}
                                />
                              ))}
                            </span>
                          </span>
                          {!spent && <span className="font-display text-sm text-leather">Cast</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetails(g)}
                          aria-label={`Details for ${nameOf(g)}`}
                          className="flex w-11 items-center justify-center border-l border-ink/10 text-ink/55 active:bg-parchment-dark"
                        >
                          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 11v5M12 8h.01" />
                          </svg>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </section>
          ))
      )}

      {open > 0 && prepared > 0 && (
        <p className="text-sm text-ink/60">
          {open} slot{open === 1 ? ' is' : 's are'} still open. You can fill {open === 1 ? 'it' : 'them'} later in the day (15 minutes of study) from{' '}
          <Link to="/prepare" className="text-leather underline">
            Prepare
          </Link>
          .
        </p>
      )}

      {details && (() => {
        const g = groups.find((x) => x.slotLevel === details.slotLevel && x.spellId === details.spellId) ?? details
        const spell = byId.get(g.spellId)
        return (
          <Sheet title={nameOf(g)} onClose={() => setDetails(undefined)}>
            <p className="-mt-2 mb-3 text-sm text-ink/70">
              {g.remaining} of {g.slotIndexes.length} left
            </p>
            <div className="mb-4 flex gap-2">
              <Button className="flex-1" disabled={!g.remaining} onClick={() => cast(g)}>
                Cast one
              </Button>
              <Button variant="secondary" className="flex-1" disabled={!g.expended} onClick={() => restore(g)}>
                Restore one
              </Button>
            </div>
            {spell && <SpellDetails spell={spell} />}
          </Sheet>
        )
      })()}
      {resting && <RestSheet character={character} onClose={() => setResting(false)} />}
      {undo && !details && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg bg-leather px-4 py-2 text-parchment shadow-lg">
          <span>Cast {undo.name}</span>
          <button
            type="button"
            className="min-h-11 px-2 font-display underline"
            onClick={async () => {
              await saveDaySlots(day.id, day.slots.map((s, i) => (i === undo.index ? { ...s, expended: false } : s)))
              setUndo(undefined)
            }}
          >
            Undo
          </button>
        </div>
      )}
    </Page>
  )
}
