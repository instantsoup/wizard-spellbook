// Reading class and domain levels from spell sources.
import type { ClassCode, ClassLevels } from '../../src/data/spell-schema.ts'

/** Cleric domains from the SRD, Spell Compendium and other 3.5 books (anything else is ignored). */
export const DOMAINS = new Set([
  'Abyss', 'Air', 'Animal', 'Arborea', 'Artifice', 'Baator', 'Balance', 'Bestial', 'Blackwater', 'Cavern', 'Celerity',
  'Celestia', 'Celestial', 'Chaos', 'Charm', 'Cold', 'Commerce', 'Community', 'Competition', 'Corruption', 'Courage',
  'Craft', 'Creation', 'Darkness', 'Death', 'Deathbound', 'Deathless', 'Decay', 'Demonic', 'Destiny', 'Destruction',
  'Diabolic', 'Domination', 'Dragon', 'Dream', 'Drow', 'Dwarf', 'Earth', 'Elf', 'Elysium', 'Endurance', 'Envy', 'Evil',
  'Exorcism', 'Family', 'Fate', 'Feast', 'Fey', 'Fire', 'Force', 'Glory', 'Gluttony', 'Gnome', 'Good', 'Greed', 'Hades',
  'Halfling', 'Hatred', 'Healing', 'Herald', 'Hunger', 'Illusion', 'Inquisition', 'Joy', 'Knowledge', 'Law', 'Liberation',
  'Life', 'Limbo', 'Luck', 'Lust', 'Madness', 'Magic', 'Mechanus', 'Meditation', 'Mentalism', 'Metal', 'Mind', 'Moon',
  'Mysticism', 'Nobility', 'Ocean', 'Oracle', 'Orc', 'Pact', 'Pain', 'Passion', 'Pestilence', 'Planning', 'Plant',
  'Pleasure', 'Portal', 'Pride', 'Protection', 'Purification', 'Renewal', 'Repose', 'Retribution', 'Rune', 'Scalykind',
  'Seafolk', 'Shadow', 'Sky', 'Slime', 'Sloth', 'Spell', 'Spider', 'Storm', 'Strength', 'Suffering', 'Summer',
  'Summoner', 'Sun', 'Thirst', 'Time', 'Trade', 'Transformation', 'Travel', 'Trickery', 'Truth', 'Tyranny', 'Undeath',
  'War', 'Water', 'Watery Death', 'Wealth', 'Weather', 'Windstorm', 'Winter', 'Wrath',
])

/** Class names and abbreviations as they appear on Level lines and in lists. */
const CLASS_ALIASES: Record<string, ClassCode[]> = {
  'sor/wiz': ['Sor', 'Wiz'], 'sorcerer/wizard': ['Sor', 'Wiz'], sor: ['Sor'], sorcerer: ['Sor'], wiz: ['Wiz'], wizard: ['Wiz'],
  clr: ['Clr'], cleric: ['Clr'], drd: ['Drd'], druid: ['Drd'], brd: ['Brd'], bard: ['Brd'],
  pal: ['Pal'], paladin: ['Pal'], rgr: ['Rgr'], ranger: ['Rgr'],
}

export interface LevelInfo {
  levels: ClassLevels
  domains: Record<string, number>
}

export const isEmpty = (l: LevelInfo) => !Object.keys(l.levels).length && !Object.keys(l.domains).length

/** Adds one "name: level" pair (class or domain); other classes are ignored. */
export function addLevel(into: LevelInfo, name: string, level: number) {
  const key = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/[*†]/g, '').trim()
  const classes = CLASS_ALIASES[key.toLowerCase()]
  if (classes) for (const c of classes) into.levels[c] = level
  else {
    const domain = [...DOMAINS].find((d) => d.toLowerCase() === key.toLowerCase().replace(/ domain$/, ''))
    if (domain) into.domains[domain] = level
  }
}

/** "Clr 2, Good 2, Sor/Wiz 3", "Sorcerer/wizard 3, cleric 4 (Kord)", "sorcerer 7/wizard 7". */
export function parseLevelText(text: string): LevelInfo {
  const out: LevelInfo = { levels: {}, domains: {} }
  const cleaned = text.replace(/\s*\([^)]*\)/g, '').replace(/(\d)\s*\/\s*(?=[a-z])/gi, '$1, ')
  for (const m of cleaned.matchAll(/([A-Za-z][A-Za-z/' -]*?)\s+(\d)\b/g)) addLevel(out, m[1], Number(m[2]))
  return out
}

/** `levels` and `domains` fields for a spell record (domains left out when empty). */
export function levelFields(l: LevelInfo): { levels: ClassLevels; domains?: Record<string, number> } {
  const sortObj = <T extends Record<string, number>>(o: T) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))) as T
  return { levels: sortObj(l.levels), ...(Object.keys(l.domains).length ? { domains: sortObj(l.domains) } : {}) }
}

/** Sort key: sorcerer/wizard level first, then the lowest other level. */
export function sortLevel(s: { levels?: ClassLevels; domains?: Record<string, number> }): number {
  const l = s.levels ?? {}
  if (l.Wiz !== undefined) return l.Wiz
  const all = [...Object.values(l), ...Object.values(s.domains ?? {})] as number[]
  return 10 + (all.length ? Math.min(...all) : 0)
}
