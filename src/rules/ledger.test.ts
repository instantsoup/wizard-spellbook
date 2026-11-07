import { describe, expect, it } from 'vitest'
import { ledgerCsv, ledgerSummary } from './ledger'
import type { KnownSpell } from './types'

const known: KnownSpell[] = [
  { spellId: 'ray-of-frost', spellLevel: 0, method: 'starting-cantrip', costGp: 0 },
  { spellId: 'magic-missile', spellLevel: 1, method: 'starting-free', freePickLevel: 1, costGp: 0 },
  { spellId: 'fireball', spellLevel: 3, method: 'levelup-free', freePickLevel: 5, costGp: 0 },
  { spellId: 'haste', spellLevel: 3, method: 'scroll', costGp: 300 },
  { spellId: 'web', spellLevel: 2, method: 'other-book', costGp: 200 },
]

describe('ledgerSummary', () => {
  it('totals what learned spells cost', () => {
    expect(ledgerSummary(known).total).toBe(500)
  })
  it('breaks costs down by method and by spell level', () => {
    const s = ledgerSummary(known)
    expect(s.byMethod.map((m) => [m.method, m.count, m.gp])).toEqual([
      ['starting-cantrip', 1, 0],
      ['starting-free', 1, 0],
      ['levelup-free', 1, 0],
      ['scroll', 1, 300],
      ['other-book', 1, 200],
    ])
    expect(s.byLevel.map((l) => [l.spellLevel, l.count, l.gp])).toEqual([
      [0, 1, 0],
      [1, 1, 0],
      [2, 1, 200],
      [3, 2, 300],
    ])
  })
  it('handles an empty book', () => {
    expect(ledgerSummary([])).toMatchObject({ total: 0, byMethod: [], byLevel: [] })
  })
})

describe('ledgerCsv', () => {
  it('sorts by date and quotes awkward cells', () => {
    const csv = ledgerCsv([
      { date: Date.UTC(2026, 10, 2), item: 'Haste', kind: 'From a scroll', gp: 300, note: 'From "Waterdeep", cheap' },
      { date: Date.UTC(2026, 10, 1), item: 'Web', kind: "From another wizard's book", gp: 200 },
    ])
    expect(csv).toBe(
      "Date,Spell,Learned,Gold (gp),Note\n2026-11-01,Web,From another wizard's book,200,\n2026-11-02,Haste,From a scroll,300,\"From \"\"Waterdeep\"\", cheap\"\n",
    )
  })
})
