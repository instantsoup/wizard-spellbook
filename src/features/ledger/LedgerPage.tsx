import { useState } from 'react'
import { gp, METHOD_LABEL } from '../../components/labels'
import { levelLabel } from '../../components/schools'
import { Button, Card, Field, inputClass, Loading, Page, SectionTitle } from '../../components/ui'
import { addLedgerEntry, deleteLedgerEntry } from '../../data/characters'
import type { CharacterRecord } from '../../data/db'
import { useKnownSpells, useLedger } from '../../data/hooks'
import { useSpells } from '../../data/spells'
import { downloadText } from '../../data/storedSpells'
import { ledgerCsv, ledgerSummary } from '../../rules'

export function LedgerPage({ character }: { character: CharacterRecord }) {
  const known = useKnownSpells(character.id)
  const manual = useLedger(character.id)
  const { byId, loading } = useSpells()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [showAll, setShowAll] = useState(false)

  if (!known || !manual || loading) return <Loading />

  const s = ledgerSummary(known, manual)
  const rows = [
    ...known
      .filter((k) => k.costGp + (k.extraCostGp ?? 0) !== 0)
      .map((k) => ({
        key: k.id,
        date: k.addedAt,
        item: byId.get(k.spellId)?.name ?? k.spellId,
        kind: METHOD_LABEL[k.method],
        gp: k.costGp + (k.extraCostGp ?? 0),
        detail: k.extraCostGp ? `${gp(k.costGp)} + ${gp(k.extraCostGp)} extra` : undefined,
        note: k.note,
        manualId: undefined as string | undefined,
      })),
    ...manual.map((m) => ({ key: m.id, date: m.at, item: m.label, kind: 'Other expense', gp: m.amountGp, detail: undefined, note: undefined, manualId: m.id })),
  ].sort((a, b) => b.date - a.date)
  const shown = showAll ? rows : rows.slice(0, 25)
  const parsed = parseInt(amount, 10)

  return (
    <Page title="Ledger" subtitle={`${character.name} · ${gp(s.total)} spent in total`}>
      <Card>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          <dt>Learning spells</dt>
          <dd className="text-right">{gp(s.learning)}</dd>
          <dt>Extra costs (scrolls, fees)</dt>
          <dd className="text-right">{gp(s.extra)}</dd>
          <dt>Other expenses</dt>
          <dd className="text-right">{gp(s.manual)}</dd>
          <dt className="border-t border-ink/20 pt-1 font-display text-lg text-leather">Total</dt>
          <dd className="border-t border-ink/20 pt-1 text-right font-display text-lg text-leather">{gp(s.total)}</dd>
        </dl>
      </Card>

      {s.byMethod.length > 0 && (
        <>
          <SectionTitle>By source</SectionTitle>
          <Card>
            <table className="w-full text-sm">
              <tbody>
                {s.byMethod.map((m) => (
                  <tr key={m.method}>
                    <td className="py-0.5">{METHOD_LABEL[m.method]}</td>
                    <td className="text-right text-ink/60">{m.count}</td>
                    <td className="w-28 text-right">{m.gp ? gp(m.gp) : 'free'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <SectionTitle>By spell level</SectionTitle>
          <Card>
            <table className="w-full text-sm">
              <tbody>
                {s.byLevel.map((l) => (
                  <tr key={l.spellLevel}>
                    <td className="py-0.5">{levelLabel(l.spellLevel)}</td>
                    <td className="text-right text-ink/60">{l.count}</td>
                    <td className="w-28 text-right">{l.gp ? gp(l.gp) : 'free'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <SectionTitle>Add an expense</SectionTitle>
      <Card>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!label.trim() || Number.isNaN(parsed)) return
            const entry = { label: label.trim(), amount: parsed }
            setLabel('')
            setAmount('')
            await addLedgerEntry(character.id, entry.label, entry.amount)
          }}
        >
          <Field label="What for">
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Rare incense, new spellbook" />
          </Field>
          <Field label="Gold (gp)" hint="Use a minus sign for money back, e.g. -50 for selling a scroll.">
            <input className={inputClass} inputMode="text" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, ''))} placeholder="0" />
          </Field>
          <Button type="submit" className="w-full" disabled={!label.trim() || Number.isNaN(parsed)}>
            Add
          </Button>
        </form>
      </Card>

      <div className="mb-2 mt-6 flex items-baseline justify-between">
        <h2 className="font-display text-lg text-leather">History</h2>
        {rows.length > 0 && (
          <Button
            variant="ghost"
            className="text-sm"
            onClick={() =>
              downloadText(
                ledgerCsv(rows.map((r) => ({ date: r.date, item: r.item, kind: r.kind, gp: r.gp, note: r.note }))),
                `${character.name.replace(/[^\w-]+/g, '-')}-ledger.csv`,
                'text/csv',
              )
            }
          >
            Export CSV
          </Button>
        )}
      </div>
      <ul>
        {shown.map((r) => (
          <li key={r.key} className="flex items-center gap-3 border-b border-ink/10 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.item}</p>
              <p className="truncate text-xs text-ink/60">
                {new Date(r.date).toLocaleDateString()} · {r.kind}
                {r.detail ? ` · ${r.detail}` : ''}
                {r.note ? ` · ${r.note}` : ''}
              </p>
            </div>
            <span className={`shrink-0 font-display ${r.gp < 0 ? 'text-good' : 'text-leather'}`}>{gp(r.gp)}</span>
            {r.manualId && (
              <button
                type="button"
                aria-label={`Delete ${r.item}`}
                className="size-9 shrink-0 text-xl text-ink/40"
                onClick={() => confirm(`Delete “${r.item}”?`) && deleteLedgerEntry(r.manualId!)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="py-4 text-center text-sm text-ink/60">Nothing spent yet. Free spells don't appear here.</p>}
      {rows.length > shown.length && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setShowAll(true)}>
          Show all {rows.length}
        </Button>
      )}
    </Page>
  )
}
