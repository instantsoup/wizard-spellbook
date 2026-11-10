// Applies verified corrections (from cross-checking against the source books) to the
// bundled spell files.
//
//   node scripts/apply-corrections.ts [data-corrections/*.json ...]
//
// Each corrections file:
//   { "source": "Spell Compendium",
//     "updates":   [{ "id", "field", "value" }],          stat/school fields, values as printed
//     "renames":   [{ "id", "name" }],                    spelling fixes; the id never changes
//     "additions": [{ name, school, level, ..., summary, page }],  missing wizard spells
//     "removals":  [{ "id", "reason" }] }                 not on the sorcerer/wizard list
//
// Additions go to public/data/spells/index-books.json with a summary-only description.
// Running it twice is harmless: updates set values, additions are skipped if present.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { slugify, validateSpellFile, SCHOOLS, type School, type Spell } from '../src/data/spell-schema.ts'

const DIR = 'public/data/spells'
const FILES = ['srd.json', 'index-extra.json', 'index-books.json']
const ADD_TO = 'index-books.json'
const FIELDS = new Set(['source', 'page', 'name', 'school', 'subschool', 'descriptors', 'level', 'components', 'castingTime', 'range',
  'target', 'targetLabel', 'area', 'effect', 'duration', 'savingThrow', 'spellResistance', 'summary'])
const COMPONENTS = ['V', 'S', 'M', 'F', 'DF', 'XP']

interface Corrections {
  source: string
  updates?: { id: string; field: string; value: unknown }[]
  renames?: { id: string; name: string }[]
  additions?: (Partial<Spell> & { name: string; summary?: string; page?: number })[]
  removals?: { id: string; reason?: string }[]
}

const args = process.argv.slice(2)
const paths = args.length ? args : readdirSync('data-corrections').filter((f) => f.endsWith('.json')).map((f) => join('data-corrections', f))

const data = new Map(FILES.map((f) => [f, JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Spell[]]))
const find = (id: string) => {
  for (const [file, list] of data) {
    const i = list.findIndex((s) => s.id === id)
    if (i >= 0) return { file, list, i }
  }
  return undefined
}
const clean = (v: string) => v.replace(/\s+/g, ' ').replace(/\.$/, '').trim()
const problems: string[] = []
const counts = { updates: 0, renames: 0, additions: 0, removals: 0, unchanged: 0 }

for (const path of paths) {
  const c = JSON.parse(readFileSync(path, 'utf8')) as Corrections
  for (const u of c.updates ?? []) {
    const hit = find(u.id)
    if (!hit) { problems.push(`${path}: update for unknown id "${u.id}"`); continue }
    if (!FIELDS.has(u.field)) { problems.push(`${path}: ${u.id}: unknown field "${u.field}"`); continue }
    const spell = hit.list[hit.i] as unknown as Record<string, unknown>
    let value = u.value
    if (u.field === 'level' || u.field === 'page') value = Number(value)
    else if (u.field === 'components') value = (value as string[]).map((x) => x.toUpperCase()).filter((x) => COMPONENTS.includes(x)).sort((a, b) => COMPONENTS.indexOf(a) - COMPONENTS.indexOf(b))
    else if (u.field === 'descriptors') value = (value as string[]).map((x) => x.trim()).filter(Boolean)
    else if (u.field === 'school' && !SCHOOLS.includes(value as School)) { problems.push(`${path}: ${u.id}: bad school ${value}`); continue }
    else if (typeof value === 'string') value = clean(value)
    if (value === '' || value === null) { delete spell[u.field]; counts.updates++; continue }
    if (JSON.stringify(spell[u.field]) === JSON.stringify(value)) { counts.unchanged++; continue }
    spell[u.field] = value
    counts.updates++
  }
  for (const r of c.renames ?? []) {
    const hit = find(r.id)
    if (!hit) { problems.push(`${path}: rename for unknown id "${r.id}"`); continue }
    hit.list[hit.i].name = r.name.replace(/’/g, "'")
    counts.renames++
  }
  for (const r of c.removals ?? []) {
    const hit = find(r.id)
    if (!hit) continue
    hit.list.splice(hit.i, 1)
    counts.removals++
  }
  const allIds = () => new Set([...data.values()].flat().map((s) => s.id))
  for (const a of c.additions ?? []) {
    const id = slugify(a.name)
    if (allIds().has(id)) continue
    const summary = clean(a.summary ?? '')
    const where = `${c.source}${a.page ? `, p. ${a.page}` : ''}`
    const spell: Spell = {
      id,
      name: a.name.replace(/’/g, "'"),
      school: a.school as School,
      ...(a.subschool ? { subschool: a.subschool } : {}),
      descriptors: a.descriptors ?? [],
      level: Number(a.level),
      components: (a.components ?? []).filter((x) => COMPONENTS.includes(x)),
      ...Object.fromEntries(
        (['castingTime', 'range', 'target', 'targetLabel', 'area', 'effect', 'duration', 'savingThrow', 'spellResistance'] as const)
          .filter((k) => a[k]).map((k) => [k, clean(String(a[k]))]),
      ),
      ...(summary ? { summary: `${summary}.` } : {}),
      description: `${summary ? `${summary}.` : 'No summary yet.'}\n\nSummary only. Full text: ${where}.`,
      source: c.source,
      ...(a.page ? { page: Number(a.page) } : {}),
    }
    data.get(ADD_TO)!.push(spell)
    counts.additions++
  }
}

for (const [file, list] of data) {
  const errors = validateSpellFile(list)
  if (errors.length) problems.push(...errors.map((e) => `${file}: ${e}`))
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
for (const [file, list] of data) {
  if (file !== 'srd.json') list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  writeFileSync(join(DIR, file), JSON.stringify(list, null, file === 'srd.json' ? 2 : 1) + '\n')
}
console.log(`Applied ${paths.length} file(s): ${counts.updates} updates, ${counts.renames} renames, ${counts.additions} additions, ${counts.removals} removals (${counts.unchanged} already correct).`)
