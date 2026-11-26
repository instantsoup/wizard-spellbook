import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass, Messages } from '../../components/ui'
import { addBook, deleteBook, updateBook } from '../../data/characters'
import type { BookRecord, KnownSpellRecord } from '../../data/db'
import { BOCCOBS_PAGES, BOOK_PAGES, pagesFor } from '../../rules'

export const bookPages = (book: BookRecord, known: KnownSpellRecord[]) =>
  known.filter((k) => k.bookId === book.id).reduce((n, k) => n + pagesFor(k.spellLevel), 0)
export const bookCapacity = (book: BookRecord) => (book.boccobs ? BOCCOBS_PAGES : BOOK_PAGES)

/**
 * Add a spellbook (first, so typing a name can't rename an existing book), then the
 * existing books: rename only through an explicit Rename button, Boccob's, delete.
 */
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
  const [listErrors, setListErrors] = useState<string[]>([])

  const add = async () => {
    const r = await addBook(characterId, name, boccobs)
    if (!r.ok) return setErrors([r.error ?? 'Something went wrong.'])
    onAdded(r.book!)
  }

  return (
    <Sheet title="Spellbooks" onClose={onClose}>
      <form
        className="mb-6"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <h3 className="mb-2 font-display text-leather">Add a spellbook</h3>
        <Field label="New book's name">
          <input autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Travelling book" />
        </Field>
        <label className="mt-2 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--color-leather)]" checked={boccobs} onChange={(e) => setBoccobs(e.target.checked)} />
          Boccob&apos;s blessed book (1000 pages, no cost to write spells in)
        </label>
        <Messages errors={errors} />
        <Button type="submit" className="mt-3 w-full">
          Add book
        </Button>
      </form>

      <h3 className="mb-2 font-display text-leather">Your spellbooks</h3>
      <Messages errors={listErrors} />
      <ul className="space-y-2">
        {books.map((b) => (
          <BookRow
            key={b.id}
            book={b}
            spells={known.filter((k) => k.bookId === b.id).length}
            pages={bookPages(b, known)}
            canDelete={books.length > 1}
            onRename={async (n) => {
              const r = await updateBook(b.id, { name: n })
              setListErrors(r.ok ? [] : [r.error ?? 'Something went wrong.'])
              return r.ok
            }}
            onBoccobs={(v) => void updateBook(b.id, { boccobs: v })}
            onDelete={async () => {
              const r = await deleteBook(b.id)
              setListErrors(r.ok ? [] : [r.error ?? 'Something went wrong.'])
            }}
          />
        ))}
      </ul>
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
  onRename: (name: string) => Promise<boolean>
  onBoccobs: (v: boolean) => void
  onDelete: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(book.name)
  const capacity = bookCapacity(book)
  return (
    <li className="rounded-lg border border-ink/20 px-3 py-2">
      {renaming ? (
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await onRename(name)) setRenaming(false)
          }}
        >
          <div className="flex-1">
            <Field label={`Rename "${book.name}"`}>
              <input autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Button type="submit">Save</Button>
          <Button
            variant="ghost"
            onClick={() => {
              setName(book.name)
              setRenaming(false)
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{book.name}</p>
            <p className={`text-xs ${pages > capacity ? 'text-rubric' : 'text-ink/60'}`}>
              {spells} spell{spells === 1 ? '' : 's'} · {pages}/{capacity} pages{pages > capacity ? ' (over the limit)' : ''}
            </p>
          </div>
          <Button variant="ghost" className="shrink-0 text-sm" aria-label={`Rename ${book.name}`} onClick={() => setRenaming(true)}>
            Rename
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--color-leather)]" checked={!!book.boccobs} onChange={(e) => onBoccobs(e.target.checked)} />
          Boccob&apos;s blessed book
        </label>
        {canDelete && (
          <Button
            variant="ghost"
            className="shrink-0 text-sm text-rubric"
            aria-label={`Delete ${book.name}`}
            onClick={() => {
              const msg = spells ? ` Its ${spells} spell${spells === 1 ? '' : 's'} will be removed from it.` : ''
              if (confirm(`Delete "${book.name}"?${msg}`)) onDelete()
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </li>
  )
}
