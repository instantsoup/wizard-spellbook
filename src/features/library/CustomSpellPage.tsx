import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Chip, Field, inputClass, Loading, Messages, Page } from '../../components/ui'
import { COMPONENTS, SCHOOLS, validateSpell, type School, type Spell } from '../../data/spell-schema'
import { useSpells } from '../../data/spells'
import { saveCustomSpell, uniqueSpellId } from '../../data/storedSpells'

type Form = Omit<Spell, 'descriptors' | 'page'> & { descriptorsText: string; pageText: string }

const BLANK: Form = {
  id: '',
  name: '',
  school: 'Evocation',
  level: 1,
  components: ['V', 'S'],
  descriptorsText: '',
  description: '',
  source: 'Homebrew',
  pageText: '',
}

const TEXT_FIELDS: [keyof Spell, string, string?][] = [
  ['castingTime', 'Casting time', '1 standard action'],
  ['range', 'Range', 'Close (25 ft. + 5 ft./2 levels)'],
  ['target', 'Target'],
  ['area', 'Area'],
  ['effect', 'Effect'],
  ['duration', 'Duration', 'Instantaneous'],
  ['savingThrow', 'Saving throw', 'Reflex half'],
  ['spellResistance', 'Spell resistance', 'Yes'],
]

function toSpell(form: Form, id: string): Spell {
  const { descriptorsText, pageText, ...rest } = form
  const spell: Record<string, unknown> = {
    ...rest,
    id,
    name: form.name.trim(),
    descriptors: descriptorsText.split(',').map((d) => d.trim()).filter(Boolean),
    ...(pageText ? { page: parseInt(pageText, 10) } : {}),
  }
  // Drop empty optional text so the stored spell stays tidy.
  for (const [k, v] of Object.entries(spell)) if (v === '' || v === undefined) delete spell[k]
  if (!form.components.includes('M')) delete spell.materialComponent
  if (!form.components.includes('F')) delete spell.focus
  if (!form.components.includes('XP')) delete spell.xpCost
  return spell as unknown as Spell
}

export function CustomSpellPage() {
  const { id } = useParams()
  const { spells, byId, loading } = useSpells()
  if (loading) return <Loading />
  const existing = id ? byId.get(id) : undefined
  if (id && !existing) return <Page title="Spell not found"><Messages errors={[`No spell with id "${id}".`]} /></Page>
  return <CustomSpellForm key={id ?? 'new'} existing={existing} takenIds={new Set(spells.map((s) => s.id))} />
}

function CustomSpellForm({ existing, takenIds }: { existing?: Spell; takenIds: Set<string> }) {
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(() =>
    existing
      ? { ...existing, descriptorsText: existing.descriptors.join(', '), pageText: existing.page ? String(existing.page) : '' }
      : BLANK,
  )
  const [saveErrors, setSaveErrors] = useState<string[]>([])
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const id = existing?.id ?? uniqueSpellId(form.name, takenIds)
  const spell = toSpell(form, id)
  const errors = form.name.trim() ? validateSpell(spell) : ['Give the spell a name.']

  const text = (key: keyof Spell, label: string, placeholder?: string) => (
    <Field key={key} label={label}>
      <input className={inputClass} placeholder={placeholder} value={(form[key as keyof Form] as string) ?? ''} onChange={(e) => set({ [key]: e.target.value } as Partial<Form>)} />
    </Field>
  )

  return (
    <Page title={existing ? 'Edit spell' : 'New spell'} subtitle={existing ? existing.name : 'Saved on this device only'}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const errs = await saveCustomSpell(spell)
          if (errs.length) return setSaveErrors(errs)
          navigate(-1)
        }}
      >
        <Card className="space-y-3">
          {text('name', 'Name', 'e.g. Orb of Fire')}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sor/Wiz level">
              <select className={inputClass} value={form.level} onChange={(e) => set({ level: Number(e.target.value) })}>
                {Array.from({ length: 10 }, (_, l) => (
                  <option key={l} value={l}>
                    {l === 0 ? '0 (cantrip)' : l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="School">
              <select className={inputClass} value={form.school} onChange={(e) => set({ school: e.target.value as School })}>
                {SCHOOLS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {text('subschool', 'Subschool', 'e.g. Creation')}
            <Field label="Descriptors" hint="Comma separated">
              <input className={inputClass} placeholder="e.g. Fire" value={form.descriptorsText} onChange={(e) => set({ descriptorsText: e.target.value })} />
            </Field>
          </div>
          {text('summary', 'One-line summary', 'Shown in spell lists')}
        </Card>

        <Card className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-semibold text-ink/80">Components</p>
            <div className="flex flex-wrap gap-1.5">
              {COMPONENTS.map((c) => (
                <Chip
                  key={c}
                  selected={form.components.includes(c)}
                  onClick={() =>
                    set({ components: form.components.includes(c) ? form.components.filter((x) => x !== c) : COMPONENTS.filter((x) => x === c || form.components.includes(x)) })
                  }
                >
                  {c}
                </Chip>
              ))}
            </div>
          </div>
          {form.components.includes('M') && text('materialComponent', 'Material component')}
          {form.components.includes('F') && text('focus', 'Focus')}
          {form.components.includes('XP') && text('xpCost', 'XP cost')}
          {TEXT_FIELDS.map(([k, label, ph]) => text(k, label, ph))}
        </Card>

        <Card className="space-y-3">
          <Field label="Description" hint="Blank line between paragraphs. _underscores_ for italics.">
            <textarea className={`${inputClass} min-h-48 py-2`} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {text('source', 'Source', 'e.g. Spell Compendium')}
            <Field label="Page">
              <input className={inputClass} inputMode="numeric" value={form.pageText} onChange={(e) => set({ pageText: e.target.value.replace(/[^0-9]/g, '') })} />
            </Field>
          </div>
        </Card>

        <Messages errors={[...errors, ...saveErrors]} />
        <Button type="submit" className="w-full" disabled={errors.length > 0}>
          Save spell
        </Button>
      </form>
    </Page>
  )
}
