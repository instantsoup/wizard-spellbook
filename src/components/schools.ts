import type { School } from '../data/spell-schema'

export const SCHOOL_STYLE: Record<School, { color: string; abbr: string }> = {
  Abjuration: { color: '#2f5d8a', abbr: 'Abj' },
  Conjuration: { color: '#a4532a', abbr: 'Conj' },
  Divination: { color: '#86701c', abbr: 'Div' },
  Enchantment: { color: '#9b3d78', abbr: 'Ench' },
  Evocation: { color: '#b22b1d', abbr: 'Evoc' },
  Illusion: { color: '#5b4a9e', abbr: 'Illus' },
  Necromancy: { color: '#3f4f3e', abbr: 'Necro' },
  Transmutation: { color: '#2e7d4f', abbr: 'Trans' },
  Universal: { color: '#6b5b4b', abbr: 'Univ' },
}

export const ordinal = (n: number) => (n === 0 ? '0' : n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)
export const levelLabel = (n: number) => (n === 0 ? 'Cantrips' : `${ordinal(n)} level`)
