import { useState } from 'react'
import { gp, METHOD_LABEL } from '../../components/labels'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass, Messages } from '../../components/ui'
import { forgetSpell, learnSpells, updateKnownSpell } from '../../data/characters'
import type { BookRecord, CharacterRecord, KnownSpellRecord } from '../../data/db'
import type { Spell } from '../../data/spell-schema'
import { entryCost, FREE_METHODS, learnCost, scrollPrice } from '../../rules'

/** Edit a spell already in the book (its note, and what the scroll cost), or remove it. */
export function EditEntrySheet({
  character,
  entry,
  spell,
  name,
  books,
  known,
  onClose,
}: {
  character: CharacterRecord
  entry: KnownSpellRecord
  spell?: Spell
  name: string
  books: BookRecord[]
  known: KnownSpellRecord[]
  onClose: () => void
}) {
  const free = FREE_METHODS.includes(entry.method)
  const fromScroll = entry.method === 'scroll'
  const [note, setNote] = useState(entry.note ?? '')
  // Entries copied before scroll prices were recorded start blank.
  const [scrollGp, setScrollGp] = useState(entry.scrollCostGp === undefined ? '' : String(entry.scrollCostGp))
  const scrollCost = Number(scrollGp)
  const scrollValid = scrollGp.trim() === '' || (Number.isFinite(scrollCost) && scrollCost >= 0)
  const bookName = books.find((b) => b.id === entry.bookId)?.name
  // Books this spell isn't written in yet, to copy it into.
  const targets = books.filter((b) => !known.some((k) => k.spellId === entry.spellId && k.bookId === b.id))
  const [target, setTarget] = useState(targets[0]?.id)
  const [copyErrors, setCopyErrors] = useState<string[]>([])
  const targetBook = targets.find((b) => b.id === target)
  const copyCost = targetBook ? learnCost(entry.spellLevel, 'copy', { boccobs: targetBook.boccobs }) : 0

  return (
    <Sheet title={name} onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-ink/70">
        {METHOD_LABEL[entry.method]}
        {entry.method === 'levelup-free' && entry.freePickLevel ? ` (level ${entry.freePickLevel})` : ''} ·{' '}
        {free ? 'free' : fromScroll ? `${gp(entry.costGp)} to scribe` : gp(entry.costGp)} · added {new Date(entry.addedAt).toLocaleDateString()}
        {books.length > 1 && bookName ? ` · in ${bookName}` : ''}
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
      {spell && targets.length > 0 && (
        <div className="mt-6 rounded-lg border border-ink/20 p-3">
          <p className="mb-2 text-sm font-semibold text-ink/80">Copy to another book</p>
          <select aria-label="Copy into" className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)}>
            {targets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.boccobs ? " (Boccob's)" : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink/60">
            {targetBook?.boccobs ? "Free in a Boccob's blessed book." : 'Copying your own spell costs half (50 gp × spell level).'}
          </p>
          <Messages errors={copyErrors} />
          <Button
            variant="secondary"
            className="mt-2 w-full"
            onClick={async () => {
              const r = await learnSpells(character, [{ spell, req: { method: 'copy', bookId: target } }])
              if (!r.ok) return setCopyErrors(r.errors)
              onClose()
            }}
          >
            Copy · {copyCost ? gp(copyCost) : 'free'}
          </Button>
        </div>
      )}
      <Button
        variant="ghost"
        className="mt-2 w-full text-rubric"
        onClick={async () => {
          const msg = free ? ' The free pick becomes available again.' : ` Its ${gp(entryCost(entry))} will no longer count toward gold spent.`
          if (!confirm(`Remove ${name} from ${bookName ?? 'your book'}?${msg}`)) return
          await forgetSpell(entry.id)
          onClose()
        }}
      >
        Remove from book
      </Button>
    </Sheet>
  )
}
