// Spell file format + validation. Used by the app and by scripts/ (build + validation).
// Keep this file free of Node-only imports so the browser can use it too.

export const SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
  'Universal',
] as const

export type School = (typeof SCHOOLS)[number]

export const COMPONENTS = ['V', 'S', 'M', 'F', 'DF', 'XP'] as const

/** Class spell lists, in the order the Level line shows them. */
export const CLASS_CODES = ['Brd', 'Clr', 'Drd', 'Pal', 'Rgr', 'Sor', 'Wiz'] as const
export type ClassCode = (typeof CLASS_CODES)[number]
export type ClassLevels = Partial<Record<ClassCode, number>>

export const CLASS_NAMES: Record<ClassCode, string> = {
  Brd: 'Bard',
  Clr: 'Cleric',
  Drd: 'Druid',
  Pal: 'Paladin',
  Rgr: 'Ranger',
  Sor: 'Sorcerer',
  Wiz: 'Wizard',
}

/**
 * A spell as stored in a spell file. Class levels are in `levels` (and cleric `domains`).
 * Older files and imports may give only `level`, which means the sorcerer/wizard level.
 */
export interface SpellRecord {
  /** Unique across every spell file, lowercase-kebab, e.g. "fireball". */
  id: string
  name: string
  school: School
  subschool?: string
  descriptors: string[]
  /** Level per class list, e.g. { Sor: 3, Wiz: 3, Clr: 4 }. */
  levels?: ClassLevels
  /** Cleric domain levels, e.g. { Fire: 4 }. */
  domains?: Record<string, number>
  /** Legacy: sorcerer/wizard level, for files without `levels`. */
  level?: number
  components: string[]
  materialComponent?: string
  focus?: string
  xpCost?: string
  castingTime?: string
  range?: string
  target?: string
  /** Overrides the "Target" label, e.g. "Target or Area". */
  targetLabel?: string
  area?: string
  effect?: string
  duration?: string
  savingThrow?: string
  spellResistance?: string
  /** One-line summary for lists, e.g. "1d6 damage per level, 20-ft. radius." */
  summary?: string
  /** Markdown. */
  description: string
  /** Book the spell comes from, e.g. "PHB", "Spell Compendium", "Homebrew". */
  source: string
  page?: number
}

/**
 * A spell as the app uses it: `level` is its level on the class list being shown (for a
 * wizard, the Sor/Wiz level), and `levels` is always filled in.
 */
export interface Spell extends Omit<SpellRecord, 'level' | 'levels'> {
  level: number
  levels: ClassLevels
}

/** Class levels of a record, reading legacy `level` as sorcerer/wizard. */
export function classLevels(s: Pick<SpellRecord, 'levels' | 'level'>): ClassLevels {
  if (s.levels) return s.levels
  return s.level === undefined ? {} : { Sor: s.level, Wiz: s.level }
}

/** A class list, or every spell ('all'). */
export type SpellList = ClassCode | 'all'

/** Every level a spell has, on any class list or domain. */
export function allLevels(s: Pick<SpellRecord, 'levels' | 'level' | 'domains'>): number[] {
  return [...new Set([...Object.values(classLevels(s)), ...Object.values(s.domains ?? {})])] as number[]
}

/**
 * The spells on one class list, with `level` set to that class's level. For 'all', every
 * spell, with `level` set to its lowest level on any list.
 */
export function spellsForClass(records: SpellRecord[], cls: SpellList): Spell[] {
  const out: Spell[] = []
  for (const r of records) {
    const levels = classLevels(r)
    const level = cls === 'all' ? Math.min(...allLevels(r)) : levels[cls]
    if (level === undefined || !Number.isFinite(level)) continue
    const { level: _legacy, ...rest } = r
    out.push({ ...rest, levels, level })
  }
  return out
}

/** "Brd 2, Clr 3, Sor/Wiz 3, Fire 4" (Sor and Wiz at the same level are joined). */
export function levelLine(s: Pick<SpellRecord, 'levels' | 'level' | 'domains'>): string {
  const lv = classLevels(s)
  const parts: string[] = []
  for (const c of CLASS_CODES) {
    const n = lv[c]
    if (n === undefined) continue
    if (c === 'Sor' && lv.Wiz === n) continue
    parts.push(`${c === 'Wiz' && lv.Sor === n ? 'Sor/Wiz' : c} ${n}`)
  }
  for (const [d, n] of Object.entries(s.domains ?? {}).sort(([a], [b]) => a.localeCompare(b))) parts.push(`${d} ${n}`)
  return parts.join(', ')
}

const STRING_FIELDS = [
  'subschool',
  'summary',
  'materialComponent',
  'focus',
  'xpCost',
  'castingTime',
  'range',
  'target',
  'targetLabel',
  'area',
  'effect',
  'duration',
  'savingThrow',
  'spellResistance',
] as const

const KNOWN_FIELDS = new Set<string>([
  'id',
  'name',
  'school',
  'descriptors',
  'level',
  'levels',
  'domains',
  'components',
  'description',
  'source',
  'page',
  ...STRING_FIELDS,
])

export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Returns a list of problems with one spell; empty means valid. */
export function validateSpell(raw: unknown): string[] {
  const errors: string[] = []
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return ['spell is not an object']
  }
  const s = raw as Record<string, unknown>
  const isNonEmptyString = (v: unknown) => typeof v === 'string' && v.trim() !== ''

  if (!isNonEmptyString(s.id)) errors.push('missing "id"')
  else if (!ID_PATTERN.test(s.id as string)) errors.push(`"id" must be lowercase-kebab (got "${s.id}")`)
  if (!isNonEmptyString(s.name)) errors.push('missing "name"')
  if (!SCHOOLS.includes(s.school as School)) {
    errors.push(`"school" must be one of ${SCHOOLS.join(', ')} (got ${JSON.stringify(s.school)})`)
  }
  const isLevel = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 9
  if (s.level !== undefined && !isLevel(s.level)) {
    errors.push(`"level" must be a whole number 0–9 (got ${JSON.stringify(s.level)})`)
  }
  for (const key of ['levels', 'domains'] as const) {
    const v = s[key]
    if (v === undefined) continue
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      errors.push(`"${key}" must be an object like {"${key === 'levels' ? 'Wiz' : 'Fire'}": 3}`)
      continue
    }
    for (const [k, n] of Object.entries(v)) {
      if (key === 'levels' && !CLASS_CODES.includes(k as ClassCode)) errors.push(`unknown class "${k}" in "levels" (use ${CLASS_CODES.join(', ')})`)
      if (!isLevel(n)) errors.push(`"${key}.${k}" must be a whole number 0–9`)
    }
  }
  if (s.level === undefined && s.levels === undefined && s.domains === undefined) {
    errors.push('missing "levels" (or "level" for a sorcerer/wizard spell)')
  }
  if (!Array.isArray(s.descriptors) || !s.descriptors.every(isNonEmptyString)) {
    errors.push('"descriptors" must be a list of strings (use [] for none)')
  }
  if (!Array.isArray(s.components) || !s.components.every((c) => COMPONENTS.includes(c as never))) {
    errors.push(`"components" must be a list using only ${COMPONENTS.join(', ')}`)
  }
  if (!isNonEmptyString(s.description)) errors.push('missing "description"')
  if (!isNonEmptyString(s.source)) errors.push('missing "source"')
  if (s.page !== undefined && !Number.isInteger(s.page)) errors.push('"page" must be a whole number')
  for (const f of STRING_FIELDS) {
    if (s[f] !== undefined && typeof s[f] !== 'string') errors.push(`"${f}" must be text`)
  }
  for (const key of Object.keys(s)) {
    if (!KNOWN_FIELDS.has(key)) errors.push(`unknown field "${key}"`)
  }
  return errors
}

/** Validates a whole spell file (an array of spells). */
export function validateSpellFile(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ['file must contain a JSON array of spells']
  const errors: string[] = []
  const seen = new Set<string>()
  raw.forEach((spell, i) => {
    const label = (spell as { name?: string })?.name ?? `#${i}`
    for (const e of validateSpell(spell)) errors.push(`${label}: ${e}`)
    const id = (spell as { id?: string })?.id
    if (id) {
      if (seen.has(id)) errors.push(`${label}: duplicate id "${id}"`)
      seen.add(id)
    }
  })
  return errors
}
