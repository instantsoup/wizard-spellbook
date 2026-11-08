// Converts a third-party 3.5 spell list (name/source{abbr,page}/school/subschool/descriptor/levels/
// components/castingTime/range/duration/savingThrow/spellResistance/description) into the app's
// spell file format. Keeps only Sor/Wiz spells and skips spells already in srd.json.
//
// The output can be imported in the app (My spells → Import file) or bundled as an index file.
// Such lists usually contain non-open books: bundle summaries only, never full text.
//   node scripts/convert-spell-list.ts <list.json> public/data/spells/srd.json <out.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { slugify, validateSpellFile, SCHOOLS, type Spell } from '../src/data/spell-schema.ts'

const [input, srdPath, out] = process.argv.slice(2)
const raw = JSON.parse(readFileSync(input, 'utf8')) as any[] // eslint-disable-line
const srdIds = new Set((JSON.parse(readFileSync(srdPath, 'utf8')) as Spell[]).map((s) => s.id))

// Abbreviations used by the list, checked against imarvintpa.com's source index.
const BOOKS: Record<string, string> = {
  SPC: 'Spell Compendium', BV: 'Book of Vile Darkness', BE: 'Book of Exalted Deeds', PH2: "Player's Handbook II",
  CAr: 'Complete Arcane', CAd: 'Complete Adventurer', CD: 'Complete Divine', CS: 'Complete Scoundrel',
  STO: 'Stormwrack', LM: 'Libris Mortis', LoM: 'Lords of Madness', MH: 'Miniatures Handbook', SS: 'Savage Species',
  MoI: 'Magic of Incarnum', RW: 'Races of the Wild', BoEM: 'Book of Eldritch Might', HB: 'Heroes of Battle',
  CR: 'Champions of Ruin', CV: 'Champions of Valor', SK: 'Serpent Kingdoms', Rac: 'Races of Faerûn',
  SMW: 'Silver Marches Web Enhancement', FCotW: 'Far Corners of the World', SKR: 'SeanKReynolds.com',
  CC: 'Complete Champion', CW: 'Complete Warrior', SRD: 'SRD',
}

// Allowed at the table: only the books in the player's library (no Forgotten Realms or
// Eberron). Everything else in the list (other books, Dragon Magazine issues, websites,
// third-party books) is left out.
const ALLOWED_SOURCES = new Set([
  'SRD', // core rules (PHB, DMG, MM, Expanded Psionics Handbook, Epic Level Handbook)
  'SPC', // Spell Compendium
  'PH2', // Player's Handbook II
  'CAr', 'CAd', 'CD', 'CS', 'CC', 'CW', // Complete Arcane / Adventurer / Divine / Scoundrel / Champion / Warrior
  'LM', // Libris Mortis
  'BV', 'BE', // Book of Vile Darkness, Book of Exalted Deeds
  'SS', // Savage Species
  'RW', // Races of the Wild
  'MoI', // Magic of Incarnum
])

const book = (abbr: string) => BOOKS[abbr] ?? (abbr.startsWith('Dragon ') ? `Dragon Magazine #${abbr.slice(7)}` : abbr)
const STANDARD = new Set(['V', 'S', 'M', 'F', 'DF', 'XP'])

const result: Spell[] = []
const skipped = { notWizard: 0, alreadyBuiltIn: 0, excludedBook: 0 }
for (const x of raw) {
  const level = x.levels?.['Sor/Wiz']
  if (level === undefined) { skipped.notWizard++; continue }
  const id = slugify(x.name)
  if (srdIds.has(id)) { skipped.alreadyBuiltIn++; continue }
  if (!ALLOWED_SOURCES.has(x.source?.abbr)) { skipped.excludedBook++; continue }
  if (!SCHOOLS.includes(x.school)) throw new Error(`${x.name}: unknown school ${x.school}`)

  const comps: string[] = []
  const special: string[] = []
  for (const tok of String(x.components ?? '').split(/,\s*/).map((t: string) => t.trim()).filter(Boolean)) {
    const base = tok.split('/')[0] // "M/DF" -> M for an arcane caster
    if (STANDARD.has(base)) { if (!comps.includes(base)) comps.push(base) }
    else if (tok !== 'text') special.push(tok)
  }
  const order = ['V', 'S', 'M', 'F', 'DF', 'XP']
  comps.sort((a, b) => order.indexOf(a) - order.indexOf(b))

  const src = x.source?.abbr ?? 'Unknown'
  const where = `${book(src)}${x.source?.page ? `, p. ${x.source.page}` : ''}`
  const summary = String(x.description ?? '').trim()
  const desc = [
    summary,
    special.length ? `_Special component${special.length > 1 ? 's' : ''}:_ ${special.join(', ')}.` : '',
    `Summary only. Full text: ${where}.`,
  ].filter(Boolean).join('\n\n')

  const spell: Spell = {
    id,
    name: x.name,
    school: x.school,
    ...(x.subschool ? { subschool: x.subschool } : {}),
    descriptors: (x.descriptor ?? []).filter((d: string) => d && d.trim()),
    level,
    components: comps,
    ...(x.castingTime ? { castingTime: x.castingTime } : {}),
    ...(x.range ? { range: x.range } : {}),
    ...(x.duration ? { duration: x.duration } : {}),
    ...(x.savingThrow ? { savingThrow: x.savingThrow } : {}),
    ...(x.spellResistance ? { spellResistance: x.spellResistance } : {}),
    ...(summary ? { summary } : {}),
    description: desc,
    source: book(src),
    ...(Number.isInteger(x.source?.page) ? { page: x.source.page } : {}),
  }
  result.push(spell)
}
result.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
const errors = validateSpellFile(result)
if (errors.length) { console.error(errors.slice(0, 30).join('\n')); process.exit(1) }
writeFileSync(out, JSON.stringify(result, null, 1) + '\n')
const bySource = result.reduce<Record<string, number>>((m, s) => ((m[s.source] = (m[s.source] ?? 0) + 1), m), {})
console.log(`Wrote ${result.length} wizard spells. Skipped: ${skipped.notWizard} not on the Sor/Wiz list, ${skipped.alreadyBuiltIn} already built in with full text, ${skipped.excludedBook} from books not in the allowed list.`)
console.log('By level:', JSON.stringify(result.reduce<Record<number, number>>((m, s) => ((m[s.level] = (m[s.level] ?? 0) + 1), m), {})))
console.log('By source:', JSON.stringify(Object.entries(bySource).sort((a, b) => b[1] - a[1])))
console.log('With special components:', result.filter((s) => s.description.includes('_Special component')).length)
