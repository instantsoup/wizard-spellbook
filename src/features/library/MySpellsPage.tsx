import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SCHOOL_STYLE } from '../../components/schools'
import { Button, Card, Messages, Page, SectionTitle } from '../../components/ui'
import { db } from '../../data/db'
import { deleteStoredSpell, downloadJson, exportStoredSpells, importSpellFile } from '../../data/storedSpells'

export function MySpellsPage() {
  const stored = useLiveQuery(() => db.storedSpells.orderBy('id').toArray(), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ errors?: string[]; warnings?: string[] }>({})

  const onImport = async (file: File) => {
    const r = await importSpellFile(await file.text())
    setMsg(
      r.ok
        ? { warnings: [`Imported ${file.name}: ${r.added} new, ${r.replaced} updated.`] }
        : { errors: [`${file.name} was not imported:`, ...r.errors.slice(0, 20), ...(r.errors.length > 20 ? [`…and ${r.errors.length - 20} more`] : [])] },
    )
  }

  const onDelete = async (id: string, name: string) => {
    const inBooks = await db.knownSpells.where('spellId').equals(id).count()
    const warn = inBooks ? `\n\nIt is in ${inBooks} spellbook${inBooks === 1 ? '' : 's'}; it will show as missing there.` : ''
    if (confirm(`Delete ${name} from this device?${warn}`)) await deleteStoredSpell(id)
  }

  const sorted = [...(stored ?? [])].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))

  return (
    <Page title="My spells" subtitle="Imported and custom spells on this device">
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Link to="/library/custom">
            <Button className="w-full">New spell</Button>
          </Link>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Import file…
          </Button>
        </div>
        <Button variant="secondary" className="w-full" disabled={!sorted.length} onClick={async () => downloadJson(await exportStoredSpells(), 'my-spells.json')}>
          Export as JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void onImport(f)
          }}
        />
        <p className="text-xs text-ink/60">
          Files use the same format as the app's built-in spell list (see docs/spell-format.md in the project). Spells here stay on this phone and
          are included in your backups. A spell with the same id as a built-in spell replaces it.
        </p>
        <Messages {...msg} />
      </Card>

      <SectionTitle>{sorted.length ? `${sorted.length} spell${sorted.length === 1 ? '' : 's'}` : 'No spells yet'}</SectionTitle>
      <ul>
        {sorted.map((s) => (
          <li key={s.id} className="flex items-center gap-3 border-b border-ink/10 py-2">
            <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: SCHOOL_STYLE[s.school].color }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="text-xs text-ink/60">
                Level {s.level} · {s.school} · {s.source} · {s.origin}
              </p>
            </div>
            <Link to={`/library/custom/${s.id}`}>
              <Button variant="ghost">Edit</Button>
            </Link>
            <Button variant="ghost" className="text-rubric" onClick={() => onDelete(s.id, s.name)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </Page>
  )
}
