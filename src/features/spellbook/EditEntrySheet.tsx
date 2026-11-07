import { useState } from 'react'
import { METHOD_LABEL } from '../../components/labels'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass } from '../../components/ui'
import { forgetSpell, updateKnownSpell } from '../../data/characters'
import type { KnownSpellRecord } from '../../data/db'
import { FREE_METHODS } from '../../rules'

const digits = (s: string) => s.replace(/[^0-9]/g, '')

/** Correct the extra cost or note of a spell already in the book, or remove it. */
export function EditEntrySheet({ entry, name, onClose }: { entry: KnownSpellRecord; name: string; onClose: () => void }) {
  const free = FREE_METHODS.includes(entry.method)
  const [extra, setExtra] = useState(entry.extraCostGp ? String(entry.extraCostGp) : '')
  const [note, setNote] = useState(entry.note ?? '')

  return (
    <Sheet title={name} onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-ink/70">
        {METHOD_LABEL[entry.method]}
        {entry.method === 'levelup-free' && entry.freePickLevel ? ` (wizard level ${entry.freePickLevel})` : ''} · added{' '}
        {new Date(entry.addedAt).toLocaleDateString()}
      </p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-sm font-semibold text-ink/80">Cost to learn</p>
          <p className="flex min-h-11 items-center font-display text-lg text-leather">{free ? 'Free' : `${entry.costGp.toLocaleString()} gp`}</p>
        </div>
        <Field label="Extra cost (gp)">
          <input className={inputClass} inputMode="numeric" placeholder="0" value={extra} onChange={(e) => setExtra(digits(e.target.value))} />
        </Field>
      </div>
      <Field label="Note">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button
        className="mt-4 w-full"
        onClick={async () => {
          await updateKnownSpell(entry.id, {
            extraCostGp: parseInt(extra, 10) || 0,
            note: note.trim(),
          })
          onClose()
        }}
      >
        Save
      </Button>
      <Button
        variant="ghost"
        className="mt-2 w-full text-rubric"
        onClick={async () => {
          const spent = entry.costGp + (entry.extraCostGp ?? 0)
          if (!confirm(`Remove ${name} from your book?${spent ? ` Its ${spent.toLocaleString()} gp will no longer count toward gold spent.` : ''}${free ? ' The free pick becomes available again.' : ''}`)) return
          await forgetSpell(entry.id)
          onClose()
        }}
      >
        Remove from book
      </Button>
    </Sheet>
  )
}
