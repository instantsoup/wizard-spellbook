import { useMemo, useState } from 'react'
import { ordinal } from '../../components/schools'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass, Messages } from '../../components/ui'
import { learnSpells } from '../../data/characters'
import type { CharacterRecord, KnownSpellRecord } from '../../data/db'
import type { Spell } from '../../data/spell-schema'
import { canLearn, freePickStatus, learnCost, type AcquisitionMethod, type LearnRequest } from '../../rules'

type Choice = 'free' | Extract<AcquisitionMethod, 'scroll' | 'other-book' | 'research' | 'other'>

const PAID: { value: Choice; label: string }[] = [
  { value: 'scroll', label: 'From a scroll' },
  { value: 'other-book', label: "From another wizard's book" },
  { value: 'research', label: 'Independent research' },
  { value: 'other', label: 'Other' },
]

export function AddToBookSheet({
  character,
  spell,
  known,
  onClose,
  onAdded,
}: {
  character: CharacterRecord
  spell: Spell
  known: KnownSpellRecord[]
  onClose: () => void
  onAdded: (message: string) => void
}) {
  // Free picks this spell could use. Prefer the lowest granting level that fits,
  // keeping higher-level picks for higher-level spells.
  const freeOptions = useMemo(
    () =>
      freePickStatus(character, known).filter(
        (s) => s.remaining > 0 && (s.wizardLevel === 1 ? spell.level === 1 : spell.level <= s.maxSpellLevel),
      ),
    [character, known, spell.level],
  )
  const canUseFree = spell.level > 0 && freeOptions.length > 0
  const [choice, setChoice] = useState<Choice>(canUseFree ? 'free' : 'scroll')
  const [freeLevel, setFreeLevel] = useState(freeOptions[0]?.wizardLevel)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveErrors, setSaveErrors] = useState<string[]>([])

  const req: LearnRequest =
    choice === 'free'
      ? { method: freeLevel === 1 ? 'starting-free' : 'levelup-free', freePickLevel: freeLevel }
      : { method: choice }
  const cost = learnCost(spell.level, req.method)
  const result = canLearn(character, spell, known, req)

  const add = async () => {
    setBusy(true)
    const r = await learnSpells(character, [
      { spell, req, note: note.trim() || undefined },
    ])
    setBusy(false)
    if (!r.ok) return setSaveErrors(r.errors)
    const total = cost
    onAdded(`${spell.name} added${total ? ` · ${total.toLocaleString()} gp` : ' · free'}`)
  }

  return (
    <Sheet title={`Add ${spell.name}`} onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-ink/70">
        {spell.school} · {spell.level === 0 ? 'cantrip' : `${ordinal(spell.level)}-level`}
      </p>

      <fieldset className="mb-4 space-y-2">
        <legend className="mb-2 text-sm font-semibold text-ink/80">How did you learn it?</legend>
        {canUseFree && (
          <Option checked={choice === 'free'} onSelect={() => setChoice('free')} label="Free spell from leveling up">
            {choice === 'free' && (
              <select
                aria-label="Which level's free pick"
                className={`${inputClass} mt-2`}
                value={freeLevel}
                onChange={(e) => setFreeLevel(Number(e.target.value))}
              >
                {freeOptions.map((s) => (
                  <option key={s.wizardLevel} value={s.wizardLevel}>
                    {s.wizardLevel === 1 ? 'Starting spell (1st level)' : `Wizard level ${s.wizardLevel}`} · {s.remaining} left
                  </option>
                ))}
              </select>
            )}
          </Option>
        )}
        {PAID.map((p) => (
          <Option key={p.value} checked={choice === p.value} onSelect={() => setChoice(p.value)} label={p.label} />
        ))}
      </fieldset>

      {choice !== 'free' && (
        <p className="mb-4 text-sm">
          <span className="font-semibold text-ink/80">Cost to learn: </span>
          <span className="font-display text-lg text-leather">{cost.toLocaleString()} gp</span>
          <span className="text-ink/60"> (100 gp × spell level)</span>
        </p>
      )}
      <Field label="Note (optional)">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. From the lich's tome, session 12" />
      </Field>

      <div className="mt-4 space-y-3">
        <Messages errors={[...result.errors, ...saveErrors]} warnings={result.warnings} />
        <Button className="w-full" disabled={!result.ok || busy} onClick={add}>
          Add to book{choice === 'free' ? ' · free' : ` · ${cost.toLocaleString()} gp`}
        </Button>
      </div>
    </Sheet>
  )
}

function Option({ checked, onSelect, label, children }: { checked: boolean; onSelect: () => void; label: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${checked ? 'border-leather bg-surface/60' : 'border-ink/20'}`}>
      <label className="flex min-h-9 items-center gap-3">
        <input type="radio" name="method" checked={checked} onChange={onSelect} className="size-5 accent-[var(--color-leather)]" />
        <span>{label}</span>
      </label>
      {children}
    </div>
  )
}
