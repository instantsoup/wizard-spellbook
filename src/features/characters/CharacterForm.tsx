import { useState } from 'react'
import { SCHOOL_STYLE } from '../../components/schools'
import { Button, Card, Chip, Field, inputClass, Messages, SectionTitle, Stepper } from '../../components/ui'
import type { CharacterInput } from '../../data/characters'
import {
  abilityModifier,
  requiredProhibitedCount,
  SPECIALIZABLE_SCHOOLS,
  validateCharacter,
  type School,
} from '../../rules'
import { SlotPreview } from './SlotPreview'

export const NEW_CHARACTER: CharacterInput = {
  name: '',
  wizardLevel: 1,
  int: { base: 16, enhancement: 0, inherent: 0 },
  intModAtLevel1: 3,
  prohibited: [],
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export function CharacterForm({
  initial = NEW_CHARACTER,
  submitLabel,
  onSubmit,
  isNew,
}: {
  initial?: CharacterInput
  submitLabel: string
  onSubmit: (c: CharacterInput) => void | Promise<void>
  isNew?: boolean
}) {
  const [c, setC] = useState<CharacterInput>(initial)
  // Starting Int follows base Int for a new character until edited by hand.
  const [startIntTouched, setStartIntTouched] = useState(!isNew)
  const [startInt, setStartInt] = useState(10 + initial.intModAtLevel1 * 2)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<CharacterInput>) => setC((prev) => ({ ...prev, ...patch }))
  const setInt = (patch: Partial<CharacterInput['int']>) => {
    const int = { ...c.int, ...patch }
    const changes: Partial<CharacterInput> = { int }
    if (!startIntTouched && patch.base !== undefined) {
      setStartInt(patch.base)
      changes.intModAtLevel1 = abilityModifier(patch.base)
    }
    set(changes)
  }

  const need = requiredProhibitedCount(c.specialty)
  const result = validateCharacter(c)
  const errors = [...(c.name.trim() ? [] : ['Give your wizard a name.']), ...result.errors]
  const totalInt = c.int.base + c.int.enhancement + c.int.inherent

  const toggleProhibited = (s: School) =>
    set({ prohibited: c.prohibited.includes(s) ? c.prohibited.filter((p) => p !== s) : [...c.prohibited, s] })

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (errors.length) return
        setBusy(true)
        try {
          await onSubmit({ ...c, name: c.name.trim() })
        } finally {
          setBusy(false)
        }
      }}
    >
      <Card className="space-y-4">
        <Field label="Name">
          <input className={inputClass} value={c.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Mialee" autoComplete="off" />
        </Field>
        <Field label="Wizard level" group>
          <Stepper label="Wizard level" value={c.wizardLevel} min={1} max={20} onChange={(v) => set({ wizardLevel: v })} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg text-leather">Intelligence</h2>
          <span className="font-display text-xl text-leather">
            {totalInt} <span className="text-base text-ink/60">({signed(abilityModifier(totalInt))})</span>
          </span>
        </div>
        <Field group label="Base Int" hint="Ability score, including racial and level-up increases.">
          <Stepper label="Base Int" value={c.int.base} min={3} max={50} onChange={(v) => setInt({ base: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Enhancement" hint="Headband of Intellect">
            <select className={inputClass} value={c.int.enhancement} onChange={(e) => setInt({ enhancement: Number(e.target.value) })}>
              {[0, 2, 4, 6].map((n) => (
                <option key={n} value={n}>
                  {n ? `+${n}` : 'None'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inherent" hint="Tome, wish">
            <select className={inputClass} value={c.int.inherent} onChange={(e) => setInt({ inherent: Number(e.target.value) })}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n ? `+${n}` : 'None'}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          group
          label="Int at 1st level"
          hint={`Sets your starting free 1st-level spells: 3 + modifier = ${Math.max(0, 3 + c.intModAtLevel1)}.`}
        >
          <Stepper
            label="Int at 1st level"
            value={startInt}
            min={3}
            max={30}
            onChange={(v) => {
              setStartIntTouched(true)
              setStartInt(v)
              set({ intModAtLevel1: abilityModifier(v) })
            }}
          />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg text-leather">School</h2>
        <Field label="Specialty">
          <select
            className={inputClass}
            value={c.specialty ?? ''}
            onChange={(e) => {
              const specialty = (e.target.value || undefined) as School | undefined
              set({ specialty, prohibited: specialty ? c.prohibited.filter((p) => p !== specialty) : [] })
            }}
          >
            <option value="">Generalist (no specialty)</option>
            {SPECIALIZABLE_SCHOOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        {c.specialty && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink/80">
              Prohibited schools{' '}
              <span className="font-normal text-ink/60">
                choose {need} ({c.prohibited.length}/{need})
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZABLE_SCHOOLS.filter((s) => s !== c.specialty).map((s) => {
                const selected = c.prohibited.includes(s)
                return (
                  <Chip
                    key={s}
                    selected={selected}
                    color={SCHOOL_STYLE[s].color}
                    disabled={s === 'Divination' || (!selected && c.prohibited.length >= need)}
                    onClick={() => toggleProhibited(s)}
                  >
                    {s}
                  </Chip>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-ink/60">Divination can't be prohibited. Specialists get one extra slot per spell level for {c.specialty} spells.</p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Spells per day</SectionTitle>
        <SlotPreview character={c} />
      </Card>

      <Messages errors={errors} warnings={result.warnings} />
      <Button type="submit" className="w-full" disabled={errors.length > 0 || busy}>
        {submitLabel}
      </Button>
    </form>
  )
}
