import { useState } from 'react'
import { gp, METHOD_LABEL } from '../../components/labels'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass } from '../../components/ui'
import { forgetSpell, updateKnownSpellNote } from '../../data/characters'
import type { KnownSpellRecord } from '../../data/db'
import { FREE_METHODS } from '../../rules'

/** Edit the note of a spell already in the book, or remove it. */
export function EditEntrySheet({ entry, name, onClose }: { entry: KnownSpellRecord; name: string; onClose: () => void }) {
  const free = FREE_METHODS.includes(entry.method)
  const [note, setNote] = useState(entry.note ?? '')

  return (
    <Sheet title={name} onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-ink/70">
        {METHOD_LABEL[entry.method]}
        {entry.method === 'levelup-free' && entry.freePickLevel ? ` (wizard level ${entry.freePickLevel})` : ''} ·{' '}
        {free ? 'free' : gp(entry.costGp)} · added {new Date(entry.addedAt).toLocaleDateString()}
      </p>
      <Field label="Note">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. From the lich's tome" />
      </Field>
      <Button
        className="mt-4 w-full"
        onClick={async () => {
          await updateKnownSpellNote(entry.id, note)
          onClose()
        }}
      >
        Save
      </Button>
      <Button
        variant="ghost"
        className="mt-2 w-full text-rubric"
        onClick={async () => {
          const msg = free ? ' The free pick becomes available again.' : ` Its ${gp(entry.costGp)} will no longer count toward gold spent.`
          if (!confirm(`Remove ${name} from your book?${msg}`)) return
          await forgetSpell(entry.id)
          onClose()
        }}
      >
        Remove from book
      </Button>
    </Sheet>
  )
}
