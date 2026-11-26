// Gold spent on the spellbook: what each learned spell cost to scribe (100 gp x spell
// level), plus the price of any scroll it was copied from.

import { entryCost } from './known'
import type { AcquisitionMethod, KnownSpell } from './types'

export interface LedgerSummary {
  total: number
  /** Scribing fees alone. */
  scribing: number
  /** Scrolls bought to copy from. */
  scrolls: number
  byMethod: { method: AcquisitionMethod; count: number; gp: number }[]
  byLevel: { spellLevel: number; count: number; gp: number }[]
}

const METHOD_ORDER: AcquisitionMethod[] = ['starting-cantrip', 'starting-free', 'levelup-free', 'scroll', 'other-book', 'research', 'copy', 'other']

export function ledgerSummary(known: KnownSpell[]): LedgerSummary {
  const sum = (ks: KnownSpell[]) => ks.reduce((n, k) => n + entryCost(k), 0)
  const byMethod = METHOD_ORDER.map((method) => {
    const ks = known.filter((k) => k.method === method)
    return { method, count: ks.length, gp: sum(ks) }
  }).filter((m) => m.count > 0)
  const levels = [...new Set(known.map((k) => k.spellLevel))].sort((a, b) => a - b)
  const byLevel = levels.map((spellLevel) => {
    const ks = known.filter((k) => k.spellLevel === spellLevel)
    return { spellLevel, count: ks.length, gp: sum(ks) }
  })
  const scribing = known.reduce((n, k) => n + k.costGp, 0)
  const scrolls = known.reduce((n, k) => n + (k.scrollCostGp ?? 0), 0)
  return { total: scribing + scrolls, scribing, scrolls, byMethod, byLevel }
}

/** Every spell in the book as CSV, oldest first; free spells show 0 gp. Ties sort by spell level, then name. */
export function ledgerCsv(
  rows: { date: number; item: string; level: number; kind: string; book?: string; scribeGp: number; scrollGp?: number; note?: string }[],
): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [['Date', 'Spell', 'Spell level', 'Learned', 'Book', 'Scribing (gp)', 'Scroll (gp)', 'Total (gp)', 'Note']]
  for (const r of [...rows].sort((a, b) => a.date - b.date || a.level - b.level || a.item.localeCompare(b.item))) {
    const scroll = r.scrollGp ?? 0
    lines.push([
      new Date(r.date).toISOString().slice(0, 10),
      r.item,
      String(r.level),
      r.kind,
      r.book ?? '',
      String(r.scribeGp),
      r.scrollGp === undefined ? '' : String(scroll),
      String(r.scribeGp + scroll),
      r.note ?? '',
    ])
  }
  return lines.map((l) => l.map(cell).join(',')).join('\n') + '\n'
}
