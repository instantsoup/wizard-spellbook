import { useMemo, useState } from 'react'
import { ordinal } from '../../components/schools'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass, Messages } from '../../components/ui'
import { learnSpells } from '../../data/characters'
import type { CharacterRecord, KnownSpellRecord } from '../../data/db'
import { useBooks } from '../../data/hooks'
import { loadSelectedBook, pickBook } from '../spellbook/selectedBook'
import type { Spell } from '../../data/spell-schema'
import { canLearn, freePickStatus, learnCost, scrollPrice, type AcquisitionMethod, type LearnRequest } from '../../rules'

type Choice = 'free' | Extract<AcquisitionMethod, 'scroll' | 'other-book' | 'research' | 'other' | 'copy'>

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
  const books = useBooks(character.id) ?? []
  // Default to the book open on the Book page, but never one that already has this spell.
  const freeBooks = books.filter((b) => !known.some((k) => k.spellId === spell.id && k.bookId === b.id))
  const [bookId, setBookId] = useState<string>()
  const book = pickBook(freeBooks, bookId ?? loadSelectedBook(character.id))
  const inOtherBook = known.some((k) => k.spellId === spell.id)
  const [choice, setChoice] = useState<Choice>(inOtherBook ? 'copy' : canUseFree ? 'free' : 'scroll')
  const [freeLevel, setFreeLevel] = useState(freeOptions[0]?.wizardLevel)
  const [note, setNote] = useState('')
  // What the scroll cost, as typed. Starts at the standard price; 0 for a scroll found as loot.
  const [scrollGp, setScrollGp] = useState(String(scrollPrice(spell.level)))
  const [busy, setBusy] = useState(false)
  const [saveErrors, setSaveErrors] = useState<string[]>([])

  const req: LearnRequest =
    choice === 'free'
      ? { method: freeLevel === 1 ? 'starting-free' : 'levelup-free', freePickLevel: freeLevel }
      : { method: choice }
  if (book) req.bookId = book.id
  const cost = learnCost(spell.level, req.method, { boccobs: book?.boccobs })
  const scrollCost = Number(scrollGp)
  const scrollValid = scrollGp.trim() !== '' && Number.isFinite(scrollCost) && scrollCost >= 0
  const total = cost + (choice === 'scroll' && scrollValid ? scrollCost : 0)
  const result = canLearn(character, spell, known, req)
  const scrollErrors = choice === 'scroll' && !scrollValid ? ['Enter what the scroll cost (0 if you found it).'] : []

  const add = async () => {
    setBusy(true)
    const r = await learnSpells(character, [
      { spell, req, note: note.trim() || undefined, ...(choice === 'scroll' ? { scrollCostGp: scrollCost } : {}) },
    ])
    setBusy(false)
    if (!r.ok) return setSaveErrors(r.errors)
    onAdded(`${spell.name} added${total ? ` · ${total.toLocaleString()} gp` : ' · free'}`)
  }

  return (
    <Sheet title={`Add ${spell.name}`} onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-ink/70">
        {spell.school} · {spell.level === 0 ? '0-level' : `${ordinal(spell.level)}-level`}
      </p>

      {books.length > 1 && (
        <div className="mb-4">
          <Field label="Which book">
            <select className={inputClass} value={book?.id} onChange={(e) => setBookId(e.target.value)}>
              {freeBooks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.boccobs ? " (Boccob's: no scribing cost)" : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <fieldset className="mb-4 space-y-2">
        <legend className="mb-2 text-sm font-semibold text-ink/80">How did you learn it?</legend>
        {inOtherBook && <Option checked={choice === 'copy'} onSelect={() => setChoice('copy')} label="Copy from your other book (half cost)" />}
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
                    {s.wizardLevel === 1 ? 'Starting spell (1st level)' : `Level ${s.wizardLevel} pick`} · {s.remaining} left
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
          <span className="font-semibold text-ink/80">Scribing cost: </span>
          <span className="font-display text-lg text-leather">{cost.toLocaleString()} gp</span>
          <span className="text-ink/60">
            {book?.boccobs ? " (Boccob's blessed book)" : choice === 'copy' ? ' (50 gp × spell level)' : ' (100 gp × spell level)'}
          </span>
        </p>
      )}
      {choice === 'scroll' && (
        <div className="mb-4">
          <Field label="What the scroll cost (gp)">
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={scrollGp}
              onChange={(e) => setScrollGp(e.target.value)}
            />
          </Field>
          <p className="mt-1 text-xs text-ink/60">
            Standard price {scrollPrice(spell.level).toLocaleString()} gp (25 gp × spell level × caster level). Copying uses the scroll up. Enter 0 if
            you found it.
          </p>
          <p className="mt-2 text-sm">
            <span className="font-semibold text-ink/80">Total: </span>
            <span className="font-display text-lg text-leather">{total.toLocaleString()} gp</span>
          </p>
        </div>
      )}
      <Field label="Note (optional)">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. From the lich's tome, session 12" />
      </Field>

      <div className="mt-4 space-y-3">
        <Messages errors={[...result.errors, ...scrollErrors, ...saveErrors]} warnings={result.warnings} />
        <Button className="w-full" disabled={!result.ok || scrollErrors.length > 0 || busy} onClick={add}>
          Add to book{choice === 'free' ? ' · free' : ` · ${total.toLocaleString()} gp`}
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
