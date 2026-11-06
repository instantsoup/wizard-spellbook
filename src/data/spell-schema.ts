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

export interface Spell {
  /** Unique across every spell file, lowercase-kebab, e.g. "fireball". */
  id: string
  name: string
  school: School
  subschool?: string
  descriptors: string[]
  /** Sor/Wiz spell level, 0–9. */
  level: number
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
  if (!Number.isInteger(s.level) || (s.level as number) < 0 || (s.level as number) > 9) {
    errors.push(`"level" must be a whole number 0–9 (got ${JSON.stringify(s.level)})`)
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
