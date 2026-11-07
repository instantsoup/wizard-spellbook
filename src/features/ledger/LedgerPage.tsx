import { useState } from 'react'
import { gp, METHOD_LABEL } from '../../components/labels'
import { levelLabel } from '../../components/schools'
import { Button, Card, Loading, Page, SectionTitle } from '../../components/ui'
import type { CharacterRecord } from '../../data/db'
import { useKnownSpells } from '../../data/hooks'
import { useSpells } from '../../data/spells'
import { downloadText } from '../../data/storedSpells'
import { ledgerCsv, ledgerSummary } from '../../rules'

/** What it has cost to add spells to the book (100 gp x spell level for each learned spell). */
export function LedgerPage({ character }: { character: CharacterRecord }) {
  const known = useKnownSpells(character.id)
  const { byId, loading } = useSpells()
  const [showAll, setShowAll] = useState(false)

  if (!known || loading) return <Loading />

  const s = ledgerSummary(known)
  const rows = known
    .filter((k) => k.costGp > 0)
    .map((k) => ({ key: k.id, date: k.addedAt, item: byId.get(k.spellId)?.name ?? k.spellId, kind: METHOD_LABEL[k.method], gp: k.costGp, note: k.note, level: k.spellLevel }))
    .sort((a, b) => b.date - a.date)
  const shown = showAll ? rows : rows.slice(0, 25)

  return (
    <Page title="Ledger" subtitle={`${character.name} · ${gp(s.total)} spent on the spellbook`}>
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
                <tr className="border-t border-ink/20 font-display text-leather">
                  <td className="pt-1">Total</td>
                  <td className="pt-1 text-right">{known.length}</td>
                  <td className="pt-1 text-right">{gp(s.total)}</td>
                </tr>
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

      <div className="mb-2 mt-6 flex items-baseline justify-between">
        <h2 className="font-display text-lg text-leather">Spells paid for</h2>
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
                {new Date(r.date).toLocaleDateString()} · {levelLabel(r.level)} · {r.kind}
                {r.note ? ` · ${r.note}` : ''}
              </p>
            </div>
            <span className="shrink-0 font-display text-leather">{gp(r.gp)}</span>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="py-4 text-center text-sm text-ink/60">No spells paid for yet. Free spells cost nothing.</p>}
      {rows.length > shown.length && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setShowAll(true)}>
          Show all {rows.length}
        </Button>
      )}
    </Page>
  )
}
