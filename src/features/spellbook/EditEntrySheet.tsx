import { useState } from 'react'
import { gp, METHOD_LABEL } from '../../components/labels'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass, Messages } from '../../components/ui'
import { forgetSpell, updateKnownSpell } from '../../data/characters'
import type { KnownSpellRecord } from '../../data/db'
import { entryCost, FREE_METHODS, scrollPrice } from '../../rules'

/** Edit a spell already in the book (its note, and what the scroll cost), or remove it. */
export function EditEntrySheet({ entry, name, onClose }: { entry: KnownSpellRecord; name: string; onClose: () => void }) {
  const free = FREE_METHODS.includes(entry.method)
  const fromScroll = entry.method === 'scroll'
  const [note, setNote] = useState(entry.note ?? '')
  // Entries copied before scroll prices were recorded start blank.
  const [scrollGp, setScrollGp] = useState(entry.scrollCostGp === undefined ? '' : String(entry.scrollCostGp))
  const scrollCost = Number(scrollGp)
  const scrollValid = scrollGp.trim() === '' || (Number.isFinite(scrollCost) && scrollCost >= 0)

  return (
    <Sheet title={name} onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-ink/70">
        {METHOD_LABEL[entry.method]}
        {entry.method === 'levelup-free' && entry.freePickLevel ? ` (level ${entry.freePickLevel})` : ''} ·{' '}
        {free ? 'free' : fromScroll ? `${gp(entry.costGp)} to scribe` : gp(entry.costGp)} · added {new Date(entry.addedAt).toLocaleDateString()}
      </p>
      {fromScroll && (
        <div className="mb-4">
          <Field label="What the scroll cost (gp)">
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={scrollGp}
              placeholder="Not recorded"
              onChange={(e) => setScrollGp(e.target.value)}
            />
          </Field>
          <p className="mt-1 text-xs text-ink/60">Standard price {gp(scrollPrice(entry.spellLevel))}. Enter 0 if you found it.</p>
        </div>
      )}
      <Field label="Note">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. From the lich's tome" />
      </Field>
      {!scrollValid && <Messages errors={['The scroll cost must be a number, 0 or more.']} />}
      <Button
        className="mt-4 w-full"
        disabled={!scrollValid}
        onClick={async () => {
          await updateKnownSpell(entry.id, {
            note,
            ...(fromScroll && scrollGp.trim() !== '' ? { scrollCostGp: scrollCost } : {}),
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
          const msg = free ? ' The free pick becomes available again.' : ` Its ${gp(entryCost(entry))} will no longer count toward gold spent.`
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
