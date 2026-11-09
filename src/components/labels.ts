import type { AcquisitionMethod } from '../rules'

export const METHOD_LABEL: Record<AcquisitionMethod, string> = {
  'starting-cantrip': 'Starting cantrip',
  'starting-free': 'Starting spell',
  'levelup-free': 'Level-up pick',
  scroll: 'From a scroll',
  'other-book': "From another wizard's book",
  research: 'Researched',
  other: 'Other',
}

export const gp = (n: number) => `${n.toLocaleString()} gp`

/** Common community abbreviations for 3.5 books. */
const BOOK_ABBR: Record<string, string> = {
  SRD: 'SRD',
  'Spell Compendium': 'SpC',
  "Player's Handbook II": 'PH2',
  'Complete Arcane': 'CAr',
  'Complete Adventurer': 'CAd',
  'Complete Divine': 'CD',
  'Complete Scoundrel': 'CSc',
  'Complete Champion': 'CC',
  'Complete Warrior': 'CW',
  'Complete Mage': 'CM',
  'Libris Mortis': 'LM',
  'Book of Vile Darkness': 'BoVD',
  'Book of Exalted Deeds': 'BoED',
  'Savage Species': 'SaS',
  'Races of the Wild': 'RotW',
  'Races of Stone': 'RoS',
  'Races of Destiny': 'RoD',
  'Races of the Dragon': 'RotD',
  'Magic of Incarnum': 'MoI',
  Frostburn: 'Fb',
  'Heroes of Horror': 'HoH',
  'Dragon Magic': 'DrM',
  Draconomicon: 'Dra',
  'Dragon Compendium': 'DrC',
  'Tome of Magic': 'ToM',
  'Unearthed Arcana': 'UA',
}

/** Short label for a spell's source book; unknown sources get initials (or the first letters). */
export function sourceAbbr(source: string): string {
  const known = BOOK_ABBR[source]
  if (known) return known
  const words = source.match(/[A-Za-z0-9]+/g) ?? []
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].length <= 5 ? words[0] : words[0].slice(0, 3)
  const significant = words.filter((w, i) => i === 0 || !/^(of|the|and|a|an)$/i.test(w))
  return significant.map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase())).join('').slice(0, 5)
}
