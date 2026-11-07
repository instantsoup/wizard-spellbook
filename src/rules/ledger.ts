// Gold spent on the spellbook: what each learned spell cost (100 gp x spell level).

import type { AcquisitionMethod, KnownSpell } from './types'

export interface LedgerSummary {
  total: number
  byMethod: { method: AcquisitionMethod; count: number; gp: number }[]
  byLevel: { spellLevel: number; count: number; gp: number }[]
}

const METHOD_ORDER: AcquisitionMethod[] = ['starting-cantrip', 'starting-free', 'levelup-free', 'scroll', 'other-book', 'research', 'other']

export function ledgerSummary(known: KnownSpell[]): LedgerSummary {
  const sum = (ks: KnownSpell[]) => ks.reduce((n, k) => n + k.costGp, 0)
  const byMethod = METHOD_ORDER.map((method) => {
    const ks = known.filter((k) => k.method === method)
    return { method, count: ks.length, gp: sum(ks) }
  }).filter((m) => m.count > 0)
  const levels = [...new Set(known.map((k) => k.spellLevel))].sort((a, b) => a - b)
  const byLevel = levels.map((spellLevel) => {
    const ks = known.filter((k) => k.spellLevel === spellLevel)
    return { spellLevel, count: ks.length, gp: sum(ks) }
  })
  return { total: sum(known), byMethod, byLevel }
}

/** CSV of every paid spell, for spreadsheets. */
export function ledgerCsv(rows: { date: number; item: string; kind: string; gp: number; note?: string }[]): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [['Date', 'Spell', 'Learned', 'Gold (gp)', 'Note']]
  for (const r of [...rows].sort((a, b) => a.date - b.date)) {
    lines.push([new Date(r.date).toISOString().slice(0, 10), r.item, r.kind, String(r.gp), r.note ?? ''])
  }
  return lines.map((l) => l.map(cell).join(',')).join('\n') + '\n'
}
