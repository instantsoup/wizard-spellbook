import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Field, inputClass, Messages, Page, SectionTitle } from '../../components/ui'
import { downloadBackup, parseBackup, restoreBackup } from '../../data/backup'
import { deleteCharacter, setActiveCharacter, updateCharacter } from '../../data/characters'
import type { CharacterRecord } from '../../data/db'
import { useCharacters, useSetting } from '../../data/hooks'
import { resolveHouseRules, type AboveCastablePolicy, type HouseRules } from '../../rules'

export function MorePage({ character }: { character: CharacterRecord }) {
  const navigate = useNavigate()
  const characters = useCharacters() ?? []
  const lastBackupAt = useSetting<number>('lastBackupAt')
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ errors?: string[]; warnings?: string[] }>({})
  const rules = resolveHouseRules(character.houseRules)
  const setRule = (patch: Partial<HouseRules>) =>
    updateCharacter(character.id, { houseRules: { ...character.houseRules, ...patch } })

  const onRestore = async (file: File) => {
    try {
      const backup = parseBackup(await file.text())
      const n = backup.data.characters?.length ?? 0
      if (!confirm(`Replace ALL data on this device with this backup (${n} wizard${n === 1 ? '' : 's'}, from ${backup.exportedAt.slice(0, 10)})?`)) return
      await restoreBackup(backup)
      setMsg({ warnings: ['Backup restored.'] })
    } catch (e) {
      setMsg({ errors: [(e as Error).message] })
    }
  }

  return (
    <Page title="More">
      <SectionTitle>Wizards</SectionTitle>
      <Card className="space-y-2">
        {characters.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2">
            <button type="button" className="min-h-11 flex-1 text-left" onClick={() => setActiveCharacter(c.id)}>
              <span className={c.id === character.id ? 'font-semibold text-rubric' : ''}>{c.name}</span>
              <span className="ml-2 text-sm text-ink/60">
                Wizard {c.wizardLevel}
                {c.specialty ? ` · ${c.specialty}` : ''}
              </span>
            </button>
            {c.id === character.id && (
              <Link to="/character">
                <Button variant="secondary">Edit</Button>
              </Link>
            )}
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Link to="/setup" className="flex-1">
            <Button variant="secondary" className="w-full">
              New wizard
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="text-rubric"
            onClick={async () => {
              if (!confirm(`Delete ${character.name} and their whole spellbook? This can't be undone.`)) return
              await deleteCharacter(character.id)
              navigate('/')
            }}
          >
            Delete {character.name}
          </Button>
        </div>
      </Card>

      <SectionTitle>Table rules</SectionTitle>
      <Card className="space-y-4">
        <Field label="Learning spells above your castable level">
          <select className={inputClass} value={rules.aboveCastableLevel} onChange={(e) => setRule({ aboveCastableLevel: e.target.value as AboveCastablePolicy })}>
            <option value="off">Not allowed</option>
            <option value="warn">Allowed, with a warning</option>
            <option value="allow">Allowed</option>
          </select>
        </Field>
        <Field label="Gold per spell level to learn a spell" hint="Cantrips count as 1st level. Free picks cost nothing.">
          <input
            className={inputClass}
            inputMode="numeric"
            value={rules.gpPerSpellLevel}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (!Number.isNaN(n) && n >= 0) setRule({ gpPerSpellLevel: n })
            }}
          />
        </Field>
        <Toggle label="Specialist slot for cantrips" checked={rules.specialistCantripSlot} onChange={(v) => setRule({ specialistCantripSlot: v })} />
        <Toggle label="Headband counts toward bonus spells" checked={rules.enhancementCountsForBonus} onChange={(v) => setRule({ enhancementCountsForBonus: v })} />
      </Card>

      <SectionTitle>Backup</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-ink/70">
          Your spellbook lives only on this device. Save a backup file now and then.
          {lastBackupAt ? ` Last backup: ${new Date(lastBackupAt).toLocaleDateString()}.` : ' No backup yet.'}
        </p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => downloadBackup()}>
            Save backup
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}>
            Restore…
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void onRestore(f)
            }}
          />
        </div>
        <Messages {...msg} />
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card className="text-sm text-ink/70">
        <p>Wizard's Spellbook for 3.5e. Spell text is Open Game Content from the System Reference Document, used under the Open Game License v1.0a.</p>
        <p className="mt-2">
          <a className="text-leather underline" href="https://github.com/instantsoup/wizard-spellbook/blob/main/OGL.md" target="_blank" rel="noreferrer">
            Open Game License
          </a>
        </p>
      </Card>
    </Page>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-sm font-semibold text-ink/80">{label}</span>
      <input type="checkbox" className="size-6 accent-[var(--color-leather)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
