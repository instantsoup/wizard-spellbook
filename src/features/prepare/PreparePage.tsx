import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { levelLabel, SCHOOL_STYLE } from '../../components/schools'
import { Button, Card, Loading, Messages, Page } from '../../components/ui'
import { saveDaySlots } from '../../data/days'
import type { CharacterRecord } from '../../data/db'
import { useKnownSpells } from '../../data/hooks'
import type { Spell } from '../../data/spell-schema'
import { useSpells } from '../../data/spells'
import { canFillSlot, computeSlots, dayUsage, minIntForSpellLevel, reconcileDay, validateDay, type PreparedSlot } from '../../rules'
import { dayTitle, RestSheet, useDay } from './shared'
import { SlotPickerSheet } from './SlotPickerSheet'
import { TemplatesSheet } from './TemplatesSheet'

export function PreparePage({ character }: { character: CharacterRecord }) {
  const day = useDay(character)
  const known = useKnownSpells(character.id)
  const { byId, loading } = useSpells()
  const [picking, setPicking] = useState<number>()
  const [sheet, setSheet] = useState<'rest' | 'templates'>()

  const knownIds = useMemo(() => new Set((known ?? []).map((k) => k.spellId)), [known])
  const knownSpells = useMemo(() => [...knownIds].map((id) => byId.get(id)).filter((s): s is Spell => !!s), [knownIds, byId])

  if (!day || !known || loading) return <Loading />

  const levels = computeSlots(character)
  const check = validateDay(character, day.slots, byId, knownIds)
  const usage = dayUsage(day.slots)
  const filled = day.slots.filter((s) => s.spellId).length
  const save = (slots: PreparedSlot[]) => saveDaySlots(day.id, slots)

  return (
    <Page
      title="Prepare"
      subtitle={`${dayTitle(day)} · ${filled}/${day.slots.length} slots filled`}
      actions={<Button onClick={() => setSheet('rest')}>Rest</Button>}
    >
      <div className="mb-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setSheet('templates')}>
          Loadouts
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={!filled}
          onClick={() => confirm('Clear every slot?') && save(day.slots.map((s) => ({ ...s, spellId: undefined, expended: false })))}
        >
          Clear all
        </Button>
      </div>

      {check.warnings.length > 0 && (
        <Card className="mb-4 flex items-center justify-between gap-3 border-rubric/30">
          <p className="text-sm">Your level or Int changed, so your slots changed too.</p>
          <Button variant="secondary" onClick={() => save(reconcileDay(character, day.slots, false))}>
            Update
          </Button>
        </Card>
      )}
      {knownSpells.length === 0 && (
        <Card className="mb-4 text-center">
          <p className="mb-3">Your book is empty.</p>
          <Link to="/library">
            <Button>Add spells</Button>
          </Link>
        </Card>
      )}

      {levels.map((l) => {
        const indexes = day.slots.map((s, i) => (s.slotLevel === l.spellLevel ? i : -1)).filter((i) => i >= 0)
        const u = usage.find((x) => x.spellLevel === l.spellLevel)
        return (
          <section key={l.spellLevel} className="mb-5">
            <div className="mb-1 flex items-baseline justify-between border-b border-leather/30">
              <h2 className="font-display text-lg text-leather">{levelLabel(l.spellLevel)}</h2>
              <span className="text-xs text-ink/60">
                {u?.prepared ?? 0}/{l.total} · {l.base} base{l.bonus ? ` + ${l.bonus} bonus` : ''}
                {l.specialist ? ` + ${l.specialist} ${SCHOOL_STYLE[character.specialty!].abbr}` : ''}
              </span>
            </div>
            {l.locked ? (
              <p className="py-2 text-sm text-rubric">You need Int {minIntForSpellLevel(l.spellLevel)} to prepare spells of this level.</p>
            ) : (
              <ul>
                {indexes.map((i) => (
                  <SlotRow
                    key={i}
                    slot={day.slots[i]}
                    spell={day.slots[i].spellId ? byId.get(day.slots[i].spellId!) : undefined}
                    error={
                      day.slots[i].spellId && byId.get(day.slots[i].spellId!)
                        ? canFillSlot(character, day.slots[i], byId.get(day.slots[i].spellId!)!, knownIds).errors[0]
                        : day.slots[i].spellId
                          ? 'This spell is missing from the spell list.'
                          : undefined
                    }
                    specialty={character.specialty}
                    onClick={() => setPicking(i)}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
      <Messages errors={check.errors.length ? ['Some slots hold spells that are no longer allowed (marked in red).'] : []} />

      {picking !== undefined && day.slots[picking] && (
        <SlotPickerSheet
          character={character}
          slot={day.slots[picking]}
          knownSpells={knownSpells}
          onClose={() => setPicking(undefined)}
          onPick={async (spellId) => {
            await save(day.slots.map((s, i) => (i === picking ? { ...s, spellId, expended: false } : s)))
            setPicking(undefined)
          }}
        />
      )}
      {sheet === 'rest' && <RestSheet character={character} onClose={() => setSheet(undefined)} />}
      {sheet === 'templates' && (
        <TemplatesSheet character={character} day={day} spellsById={byId} knownIds={knownIds} onClose={() => setSheet(undefined)} />
      )}
    </Page>
  )
}

function SlotRow({
  slot,
  spell,
  error,
  specialty,
  onClick,
}: {
  slot: PreparedSlot
  spell?: Spell
  error?: string
  specialty?: CharacterRecord['specialty']
  onClick: () => void
}) {
  const tag =
    slot.kind === 'specialist' && specialty ? (
      <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase text-parchment" style={{ backgroundColor: SCHOOL_STYLE[specialty].color }}>
        {SCHOOL_STYLE[specialty].abbr}
      </span>
    ) : slot.kind === 'bonus' ? (
      <span className="rounded border border-leather/40 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-leather">Bonus</span>
    ) : null
  return (
    <li className="border-b border-ink/10">
      <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
        <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: spell ? SCHOOL_STYLE[spell.school].color : 'transparent' }} aria-hidden />
        <span className="min-w-0 flex-1">
          {spell ? (
            <span className={`block truncate font-semibold ${slot.expended ? 'text-ink/40 line-through' : ''}`}>
              {spell.name}
              {spell.level < slot.slotLevel && <span className="ml-2 text-xs font-normal text-ink/50">({spell.level === 0 ? 'cantrip' : `level ${spell.level}`})</span>}
              {slot.expended && <span className="ml-2 text-xs font-normal no-underline">cast</span>}
            </span>
          ) : (
            <span className="block italic text-ink/45">{slot.spellId ? 'Unknown spell' : 'Empty, tap to prepare'}</span>
          )}
          {error && <span className="block text-xs text-rubric">{error}</span>}
        </span>
        {tag}
        <span className="text-ink/40" aria-hidden>
          ›
        </span>
      </button>
    </li>
  )
}
