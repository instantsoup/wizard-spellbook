// Gold spent on the spellbook: learning costs, extra costs and manual entries.

import type { AcquisitionMethod, KnownSpell } from './types'

export interface ManualEntry {
  amountGp: number
  label: string
}

export interface LedgerSummary {
  /** Learning cost (the 100 gp/level part). */
  learning: number
  /** Extra costs on spells (buying scrolls, fees). */
  extra: number
  /** Manual ledger entries (can be negative, e.g. selling a scroll). */
  manual: number
  total: number
  byMethod: { method: AcquisitionMethod; count: number; gp: number }[]
  byLevel: { spellLevel: number; count: number; gp: number }[]
}

const METHOD_ORDER: AcquisitionMethod[] = ['starting-cantrip', 'starting-free', 'levelup-free', 'scroll', 'other-book', 'research', 'other']

export function ledgerSummary(known: KnownSpell[], manual: ManualEntry[] = []): LedgerSummary {
  const learning = known.reduce((n, k) => n + k.costGp, 0)
  const extra = known.reduce((n, k) => n + (k.extraCostGp ?? 0), 0)
  const manualTotal = manual.reduce((n, m) => n + m.amountGp, 0)

  const byMethod = METHOD_ORDER.map((method) => {
    const ks = known.filter((k) => k.method === method)
    return { method, count: ks.length, gp: ks.reduce((n, k) => n + k.costGp + (k.extraCostGp ?? 0), 0) }
  }).filter((m) => m.count > 0)

  const levels = [...new Set(known.map((k) => k.spellLevel))].sort((a, b) => a - b)
  const byLevel = levels.map((spellLevel) => {
    const ks = known.filter((k) => k.spellLevel === spellLevel)
    return { spellLevel, count: ks.length, gp: ks.reduce((n, k) => n + k.costGp + (k.extraCostGp ?? 0), 0) }
  })

  return { learning, extra, manual: manualTotal, total: learning + extra + manualTotal, byMethod, byLevel }
}

/** CSV of every cost line, for spreadsheets. */
export function ledgerCsv(
  rows: { date: number; item: string; kind: string; gp: number; note?: string }[],
): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [['Date', 'Item', 'Type', 'Gold (gp)', 'Note']]
  for (const r of [...rows].sort((a, b) => a.date - b.date)) {
    lines.push([new Date(r.date).toISOString().slice(0, 10), r.item, r.kind, String(r.gp), r.note ?? ''])
  }
  return lines.map((l) => l.map(cell).join(',')).join('\n') + '\n'
}
