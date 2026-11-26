import { describe, expect, it } from 'vitest'
import { ledgerCsv, ledgerSummary } from './ledger'
import type { KnownSpell } from './types'

const known: KnownSpell[] = [
  { spellId: 'ray-of-frost', spellLevel: 0, method: 'starting-cantrip', costGp: 0 },
  { spellId: 'magic-missile', spellLevel: 1, method: 'starting-free', freePickLevel: 1, costGp: 0 },
  { spellId: 'fireball', spellLevel: 3, method: 'levelup-free', freePickLevel: 5, costGp: 0 },
  { spellId: 'haste', spellLevel: 3, method: 'scroll', costGp: 300, scrollCostGp: 375 },
  { spellId: 'web', spellLevel: 2, method: 'other-book', costGp: 200 },
]

describe('ledgerSummary', () => {
  it('totals scribing and scroll costs', () => {
    expect(ledgerSummary(known)).toMatchObject({ total: 875, scribing: 500, scrolls: 375 })
  })
  it('breaks costs down by method and by spell level', () => {
    const s = ledgerSummary(known)
    expect(s.byMethod.map((m) => [m.method, m.count, m.gp])).toEqual([
      ['starting-cantrip', 1, 0],
      ['starting-free', 1, 0],
      ['levelup-free', 1, 0],
      ['scroll', 1, 675],
      ['other-book', 1, 200],
    ])
    expect(s.byLevel.map((l) => [l.spellLevel, l.count, l.gp])).toEqual([
      [0, 1, 0],
      [1, 1, 0],
      [2, 1, 200],
      [3, 2, 675],
    ])
  })
  it('handles an empty book', () => {
    expect(ledgerSummary([])).toMatchObject({ total: 0, scribing: 0, scrolls: 0, byMethod: [], byLevel: [] })
  })
})

describe('ledgerCsv', () => {
  it('sorts by date and quotes awkward cells', () => {
    const csv = ledgerCsv([
      { date: Date.UTC(2026, 10, 2), item: 'Haste', level: 3, kind: 'From a scroll', book: 'Travelling book', scribeGp: 300, scrollGp: 375, note: 'From "Waterdeep", cheap' },
      { date: Date.UTC(2026, 10, 1), item: 'Web', level: 2, kind: "From another wizard's book", scribeGp: 200 },
      { date: Date.UTC(2026, 10, 1), item: 'Ray of Frost', level: 0, kind: 'Starting cantrip', scribeGp: 0 },
    ])
    expect(csv).toBe(
      'Date,Spell,Spell level,Learned,Book,Scribing (gp),Scroll (gp),Total (gp),Note\n' +
        '2026-11-01,Ray of Frost,0,Starting cantrip,,0,,0,\n' +
        "2026-11-01,Web,2,From another wizard's book,,200,,200,\n" +
        '2026-11-02,Haste,3,From a scroll,Travelling book,300,375,675,"From ""Waterdeep"", cheap"\n',
    )
  })
})
