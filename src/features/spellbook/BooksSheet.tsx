import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass, Messages } from '../../components/ui'
import { addBook, deleteBook, updateBook } from '../../data/characters'
import type { BookRecord, KnownSpellRecord } from '../../data/db'
import { BOCCOBS_PAGES, BOOK_PAGES, pagesFor } from '../../rules'

export const bookPages = (book: BookRecord, known: KnownSpellRecord[]) =>
  known.filter((k) => k.bookId === book.id).reduce((n, k) => n + pagesFor(k.spellLevel), 0)
export const bookCapacity = (book: BookRecord) => (book.boccobs ? BOCCOBS_PAGES : BOOK_PAGES)

/** Add, rename, delete spellbooks and mark a Boccob's blessed book. */
export function BooksSheet({
  characterId,
  books,
  known,
  onClose,
  onAdded,
}: {
  characterId: string
  books: BookRecord[]
  known: KnownSpellRecord[]
  onClose: () => void
  onAdded: (book: BookRecord) => void
}) {
  const [name, setName] = useState('')
  const [boccobs, setBoccobs] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p
    setErrors(r.ok ? [] : [r.error ?? 'Something went wrong.'])
    return r
  }

  return (
    <Sheet title="Spellbooks" onClose={onClose}>
      <ul className="mb-4 space-y-3">
        {books.map((b) => (
          <BookRow
            key={b.id}
            book={b}
            spells={known.filter((k) => k.bookId === b.id).length}
            pages={bookPages(b, known)}
            canDelete={books.length > 1}
            onRename={(n) => run(updateBook(b.id, { name: n }))}
            onBoccobs={(v) => run(updateBook(b.id, { boccobs: v }))}
            onDelete={() => run(deleteBook(b.id))}
          />
        ))}
      </ul>

      <h3 className="mb-2 font-display text-leather">Add a spellbook</h3>
      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Travelling book" />
      </Field>
      <label className="mt-2 flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--color-leather)]" checked={boccobs} onChange={(e) => setBoccobs(e.target.checked)} />
        Boccob&apos;s blessed book (1000 pages, no cost to write spells in)
      </label>
      <Messages errors={errors} />
      <Button
        className="mt-3 w-full"
        onClick={async () => {
          const r = await addBook(characterId, name, boccobs)
          if (!r.ok) return setErrors([r.error ?? 'Something went wrong.'])
          setErrors([])
          setName('')
          setBoccobs(false)
          onAdded(r.book!)
        }}
      >
        Add book
      </Button>
    </Sheet>
  )
}

function BookRow({
  book,
  spells,
  pages,
  canDelete,
  onRename,
  onBoccobs,
  onDelete,
}: {
  book: BookRecord
  spells: number
  pages: number
  canDelete: boolean
  onRename: (name: string) => Promise<{ ok: boolean }>
  onBoccobs: (v: boolean) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(book.name)
  const capacity = bookCapacity(book)
  return (
    <li className="rounded-lg border border-ink/20 p-3">
      <Field label="Name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={async () => {
            if (name.trim() === book.name) return
            const r = await onRename(name)
            if (!r.ok) setName(book.name)
          }}
        />
      </Field>
      <p className={`mt-1 text-xs ${pages > capacity ? 'text-rubric' : 'text-ink/60'}`}>
        {spells} spell{spells === 1 ? '' : 's'} · {pages}/{capacity} pages{pages > capacity ? ' (over the limit)' : ''}
      </p>
      <label className="mt-1 flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--color-leather)]" checked={!!book.boccobs} onChange={(e) => onBoccobs(e.target.checked)} />
        Boccob&apos;s blessed book
      </label>
      {canDelete && (
        <Button
          variant="ghost"
          className="w-full text-rubric"
          onClick={() => {
            const msg = spells ? ` Its ${spells} spell${spells === 1 ? '' : 's'} will be removed from it.` : ''
            if (confirm(`Delete "${book.name}"?${msg}`)) onDelete()
          }}
        >
          Delete book
        </Button>
      )}
    </li>
  )
}
