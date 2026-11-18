import type { School } from '../data/spell-schema'

export const SCHOOL_STYLE: Record<School, { color: string; abbr: string }> = {
  Abjuration: { color: 'var(--school-abjuration)', abbr: 'Abj' },
  Conjuration: { color: 'var(--school-conjuration)', abbr: 'Conj' },
  Divination: { color: 'var(--school-divination)', abbr: 'Div' },
  Enchantment: { color: 'var(--school-enchantment)', abbr: 'Ench' },
  Evocation: { color: 'var(--school-evocation)', abbr: 'Evoc' },
  Illusion: { color: 'var(--school-illusion)', abbr: 'Illus' },
  Necromancy: { color: 'var(--school-necromancy)', abbr: 'Necro' },
  Transmutation: { color: 'var(--school-transmutation)', abbr: 'Trans' },
  Universal: { color: 'var(--school-universal)', abbr: 'Univ' },
}

export const ordinal = (n: number) => (n === 0 ? '0' : n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)
/** Heading for a spell level. 0 is "0 level" (cantrips for arcane casters, orisons for divine). */
export const levelLabel = (n: number) => (n === 0 ? '0 level' : `${ordinal(n)} level`)
