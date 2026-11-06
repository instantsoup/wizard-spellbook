import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass, Messages } from '../../components/ui'
import { deleteTemplate, saveDaySlots, saveTemplate } from '../../data/days'
import type { CharacterRecord, PreparedDayRecord } from '../../data/db'
import { useTemplates } from '../../data/hooks'
import type { Spell } from '../../data/spell-schema'
import { applyPicks } from '../../rules'

export function TemplatesSheet({
  character,
  day,
  spellsById,
  knownIds,
  onClose,
}: {
  character: CharacterRecord
  day: PreparedDayRecord
  spellsById: ReadonlyMap<string, Spell>
  knownIds: ReadonlySet<string>
  onClose: () => void
}) {
  const templates = useTemplates(character.id) ?? []
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<string>()
  const filled = day.slots.filter((s) => s.spellId).length

  return (
    <Sheet title="Loadouts" onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-ink/70">Save today's picks as a loadout to reuse, like “Dungeon crawl” or “Travel day”.</p>
      <div className="mb-5 flex items-end gap-2">
        <div className="flex-1">
          <Field label="Save current picks as">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Loadout name" />
          </Field>
        </div>
        <Button
          disabled={!name.trim() || !filled}
          onClick={async () => {
            await saveTemplate(character.id, name.trim(), day.slots)
            setMsg(`Saved “${name.trim()}” (${filled} spells).`)
            setName('')
          }}
        >
          Save
        </Button>
      </div>
      {msg && <Messages warnings={[msg]} />}
      <ul className="mt-2">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-2 border-b border-ink/10 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{t.name}</p>
              <p className="text-xs text-ink/60">{t.picks.length} spells</p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                const filledNow = day.slots.some((s) => s.spellId)
                if (filledNow && !confirm(`Replace today's picks with “${t.name}”? Cast marks are cleared.`)) return
                const { slots, skipped } = applyPicks(character, day.slots, t.picks, spellsById, knownIds)
                await saveDaySlots(day.id, slots)
                if (skipped) alert(`${skipped} spell${skipped === 1 ? '' : 's'} from “${t.name}” no longer fit and were skipped.`)
                onClose()
              }}
            >
              Load
            </Button>
            <Button variant="ghost" className="text-rubric" onClick={() => confirm(`Delete “${t.name}”?`) && deleteTemplate(t.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
      {templates.length === 0 && <p className="py-4 text-center text-sm text-ink/60">No saved loadouts yet.</p>}
    </Sheet>
  )
}
