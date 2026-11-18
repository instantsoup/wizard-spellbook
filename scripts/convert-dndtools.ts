// Builds an index of extra spells from srd.dndtools.org pages.
//
//   [SUMMARIES=summaries.json] node scripts/convert-dndtools.ts <wizardSpells.html> <pages-dir> <out.json> [existing.json ...]
//
// <wizardSpells.html> is .../classSpellLists/wizardSpells.html (one row per spell: source,
// school, name, one-line summary). <pages-dir> holds the linked per-book pages
// (.../spells/spells/spellsCMage.html and so on), which give each spell's school line and
// stat block. Only those are kept (no spell text): the summary comes from the list.
//
// Kept: spells on a core class list or cleric domain (per the stat block's Level line) from
// ALLOWED books that aren't already in any of the existing spell files (matched by id, so
// existing data wins). Wizard-list spells come first, with the list's summary; the other
// spells on the book pages follow, with a summary from SUMMARIES (a JSON object of
// name -> one-line summary, e.g. from a cleric spell list) when there is one.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { slugify, validateSpellFile, SCHOOLS, type School, type SpellRecord as Spell } from '../src/data/spell-schema.ts'
import { isEmpty, levelFields, parseLevelText, sortLevel, type LevelInfo } from './lib/classes.ts'

const [listPath, pagesDir, outPath, ...existingPaths] = process.argv.slice(2)
if (!listPath || !pagesDir || !outPath) {
  console.error('usage: node scripts/convert-dndtools.ts <wizardSpells.html> <pages-dir> <out.json> [existing.json ...]')
  process.exit(1)
}

// The player's library (no Forgotten Realms or Eberron). dndtools source code -> book title.
const ALLOWED: Record<string, string> = {
  PHBII: "Player's Handbook II",
  CM: 'Complete Mage',
  CAr: 'Complete Arcane',
  CAd: 'Complete Adventurer',
  CD: 'Complete Divine',
  CS: 'Complete Scoundrel',
  CW: 'Complete Warrior',
  City: 'Cityscape',
  Drac: 'Draconomicon',
  DrM: 'Dragon Magic',
  Frost: 'Frostburn',
  HoH: 'Heroes of Horror',
  LM: 'Libris Mortis',
  MoI: 'Magic of Incarnum',
  RoD: 'Races of Destiny',
  RotD: 'Races of the Dragon',
  RoS: 'Races of Stone',
  RotW: 'Races of the Wild',
  ToM: 'Tome of Magic',
  WoL: 'Weapons of Legacy',
  BoED: 'Book of Exalted Deeds',
}

const decode = (path: string) => new TextDecoder('windows-1252').decode(readFileSync(path))
const text = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|’|ï¿½|\uFFFD/g, "'") // the site has some apostrophes as broken characters
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()

// 1. The class list: level, source, name, summary, link.
interface Row { level: number; source: string; name: string; summary: string; page: string; anchor: string }
const rows: Row[] = []
{
  const html = decode(listPath)
  let level: number | undefined
  const re = /<h5>([\s\S]*?)<\/h5>|<tr[^>]*>([\s\S]*?)<\/tr>/g
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1] !== undefined) {
      const lm = text(m[1]).match(/^(\d)/)
      level = lm ? Number(lm[1]) : undefined
      continue
    }
    const cells = [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1])
    if (cells.length !== 4 || level === undefined) continue
    const href = cells[2].match(/href="([^"]+)"/)?.[1] ?? ''
    const [page, anchor = ''] = href.split('#')
    // Some name cells carry extra text ("Rary's Arcane Conversion:", "Abj Justice of ...").
    const name = text(cells[2]).split(':')[0].replace(/^(Abj|Conj|Div|Ench|Evoc|Illus|Necro|Trans|Univ)\s+/, '').trim()
    rows.push({ level, source: text(cells[0]), name, summary: text(cells[3]), page: basename(page), anchor: decodeURIComponent(anchor) })
  }
}

// 2. Stat blocks from the book pages, keyed by page + slug of the spell name.
interface Stats { name: string; school: School; subschool?: string; descriptors: string[]; info: LevelInfo; fields: Record<string, string>; baseName?: string }
const statsCache = new Map<string, Map<string, Stats>>()
function pageStats(page: string): Map<string, Stats> {
  if (statsCache.has(page)) return statsCache.get(page)!
  const map = new Map<string, Stats>()
  const path = join(pagesDir, page)
  if (existsSync(path)) {
    // Each spell starts with an <h6> heading (markup and letter case vary between pages),
    // then its school line in <i>, then <span class="stat-block"> lines.
    const html = decode(path)
    const parts = html.split(/<h6[^>]*>/i).slice(1)
    for (const part of parts) {
      const end = part.search(/<\/h6>/i)
      if (end < 0) continue
      const name = text(part.slice(0, end))
      const rest = part.slice(end)
      const schoolLine = text(rest.match(/<p[^>]*>\s*<i>([\s\S]*?)<\/i>/i)?.[1] ?? '')
      // Dual-school spells ("Conjuration (Creation)/Necromancy") use the first school.
      const sm = schoolLine.match(/^([A-Za-z]+)\s*(?:\(([^)]+)\))?[^[]*?(?:\[([^\]]+)\])?\s*$/) ?? schoolLine.match(/^([A-Za-z]+)/)
      if (!sm || !SCHOOLS.includes(sm[1] as School)) continue
      const fields: Record<string, string> = {}
      for (const f of rest.matchAll(/<span\s+class=\s*"stat-block"\s*>\s*<b>([^<]+)<\/b>\s*:?([\s\S]*?)<\/span>/gi)) {
        const key = text(f[1]).replace(/:$/, '')
        if (!(key in fields)) fields[key] = text(f[2]).replace(/^:\s*/, '')
      }
      // "Sorcerer/wizard 3, cleric 4", "Sor/Wiz 3" or "sorcerer 7/wizard 7"; plain "Sorcerer 3" is sorcerer-only.
      const info = parseLevelText(fields.Level ?? '')
      const key = slugify(name)
      // "This spell functions like summon undead I, except ..." / "As manifest dragon heritage, except ..."
      const body = text(rest.slice(0, 3000))
      const baseName = (
        body.match(/functions (?:like|as|identically to)\s+(?:the |an? )?([A-Za-z' ,]+?)\s*(?:,|\(|\s+except|\s+spell\b|\.|\s+but\b)/i) ??
        body.match(/\bAs ([a-z][A-Za-z' ,]+?)\s*(?:,|\()\s*except/)
      )?.[1]?.trim()
      if (!map.has(key)) {
        map.set(key, {
          name,
          school: sm[1] as School,
          ...(sm[2] ? { subschool: sm[2].trim() } : {}),
          descriptors: sm[3] ? sm[3].split(',').map((d) => d.trim()).filter((d) => d && !/see text/i.test(d)) : [],
          info,
          fields,
          ...(baseName ? { baseName } : {}),
        })
      }
    }
  }
  statsCache.set(page, map)
  return map
}

// 3. Existing spells (matched by id; "Greater X" also matches "X, Greater").
const existing = new Set<string>()
const existingSpells: Spell[] = []
const existingFiles = existingPaths.map((path) => ({ path, list: JSON.parse(readFileSync(path, 'utf8')) as Spell[], dirty: false }))
const existingById = new Map<string, { spell: Spell; file: (typeof existingFiles)[number] }>()
for (const file of existingFiles) for (const s of file.list) { existing.add(s.id); existingSpells.push(s); existingById.set(s.id, { spell: s, file }) }
const baseOf = new Map<string, string>() // new spell id -> base spell name
const altId = (name: string) => {
  const m = name.match(/^(Greater|Lesser|Least|Mass|Superior|Improved) (.+)$/i)
  return m ? slugify(`${m[2]}, ${m[1]}`) : undefined
}
/** The other word order: "Greater Wings of Air" <-> "Wings of Air, Greater". */
const altIds = (name: string) => {
  const m = name.match(/^(.+), (Greater|Lesser|Least|Mass|Superior|Improved)$/i)
  return [altId(name), m ? slugify(`${m[2]} ${m[1]}`) : undefined].filter((x): x is string => !!x)
}

const COMPONENT_ORDER = ['V', 'S', 'M', 'F', 'DF', 'XP']
const skipped = { existing: 0, notAllowed: 0, noCoreList: 0, noStats: [] as string[] }
const out: Spell[] = []
const seen = new Set<string>()
const summaries: Record<string, string> = process.env.SUMMARIES ? JSON.parse(readFileSync(process.env.SUMMARIES, 'utf8')) : {}
const summaryByName = new Map(Object.entries(summaries).map(([n, t]) => [slugify(n), t]))
const findExisting = (name: string) => [slugify(name), ...altIds(name)].map((i) => existingById.get(i)).find(Boolean)
const isExisting = (name: string) => !!findExisting(name)
const compact = (name: string) => slugify(name).replace(/-/g, '')
const existingCompact = new Set([...existingById.keys()].map((i) => i.replace(/-/g, '')))
const isSeen = (name: string) => [slugify(name), ...altIds(name)].some((i) => seen.has(i))

// Sources disagree about class lists (one list leaves out a class another shows). For spells
// already in an earlier book index, add the classes and domains this Level line shows; levels
// already there are kept. The SRD file is never changed.
let levelsAdded = 0
function mergeLevels(name: string, info: LevelInfo) {
  const hit = findExisting(name)
  if (!hit || basename(hit.file.path) === 'srd.json') return
  const s = hit.spell
  const levels = { ...(s.levels ?? {}) }
  const domains = { ...(s.domains ?? {}) }
  let changed = false
  for (const [c, n] of Object.entries(info.levels)) if (levels[c as keyof typeof levels] === undefined) { levels[c as keyof typeof levels] = n; changed = true }
  for (const [d, n] of Object.entries(info.domains)) if (domains[d] === undefined) { domains[d] = n; changed = true }
  if (!changed) return
  Object.assign(s, levelFields({ levels, domains }))
  hit.file.dirty = true
  levelsAdded++
}

/**
 * A spell already in an earlier book index but not on its Sor/Wiz list, which this page puts
 * on the Sor/Wiz list: the page's version replaces it (keeping its other class levels), as
 * the book index is the source for wizard spells.
 */
function takeOver(name: string, st: Stats): { levels: LevelInfo; summary?: string } | undefined {
  const hit = findExisting(name)
  if (!hit || basename(hit.file.path) === 'srd.json' || hit.spell.levels?.Wiz !== undefined || st.info.levels.Wiz === undefined) return undefined
  hit.file.list.splice(hit.file.list.indexOf(hit.spell), 1)
  hit.file.dirty = true
  for (const i of [hit.spell.id]) existingById.delete(i)
  replaced++
  return {
    levels: { levels: { ...(hit.spell.levels ?? {}), ...st.info.levels }, domains: { ...(hit.spell.domains ?? {}), ...st.info.domains } },
    summary: hit.spell.summary,
  }
}
let replaced = 0

function addSpell(name: string, st: Stats, book: string, listSummary?: string) {
  const id = slugify(name)
  const f = st.fields
  const components = [...new Set((f.Components ?? f.Component ?? '').split(',').map((c) => c.trim().split(/[/\s]/)[0]).filter((c) => COMPONENT_ORDER.includes(c)))]
    .sort((a, b) => COMPONENT_ORDER.indexOf(a) - COMPONENT_ORDER.indexOf(b))
  const summary = (listSummary ?? summaryByName.get(id) ?? summaryByName.get(altId(name) ?? '') ?? '').replace(/\s*\((Wizard|Sorcerer) only\.?\)\s*$/i, '').trim()
  const target = f.Target ?? f.Targets ?? f['Target or Area'] ?? f['Target, Effect, or Area'] ?? f['Area or Target']
  out.push({
    id,
    name: name.replace(/’/g, "'"),
    school: st.school,
    ...(st.subschool ? { subschool: st.subschool } : {}),
    descriptors: st.descriptors,
    ...levelFields(st.info),
    components,
    ...(f['Casting Time'] ? { castingTime: f['Casting Time'] } : {}),
    ...(f.Range ? { range: f.Range } : {}),
    ...(target ? { target } : {}),
    ...(f.Area ? { area: f.Area } : {}),
    ...(f.Effect ? { effect: f.Effect } : {}),
    ...(f.Duration ? { duration: f.Duration } : {}),
    ...(f['Saving Throw'] ? { savingThrow: f['Saving Throw'] } : {}),
    ...(f['Spell Resistance'] ? { spellResistance: f['Spell Resistance'] } : {}),
    ...(summary ? { summary } : {}),
    description: `${summary || 'No summary yet.'}\n\nSummary only. Full text: ${book}.`,
    source: book,
  })
  seen.add(id)
  if (st.baseName) baseOf.set(id, st.baseName)
}

// 4a. Spells on the wizard list.
const pageBook = new Map<string, string>()
for (const r of rows) {
  const book = ALLOWED[r.source]
  if (book && r.page) pageBook.set(r.page, book)
  if (!book) { skipped.notAllowed++; continue }
  if (isSeen(r.name)) continue
  const stats = pageStats(r.page)
  const id = slugify(r.name)
  // Pages sometimes name variants "Wings of Air, Greater" where the list says "Greater Wings of Air".
  const st = stats.get(id) ?? stats.get(slugify(r.anchor)) ?? altIds(r.name).map((a) => stats.get(a)).find(Boolean)
  const over = st && takeOver(r.name, st)
  if (over) { addSpell(r.name, { ...st!, info: over.levels }, book, r.summary || over.summary); continue }
  if (isExisting(r.name)) { skipped.existing++; if (st) mergeLevels(r.name, st.info); continue }
  if (!st) { skipped.noStats.push(`${r.name} (${r.page})`); continue }
  if (isEmpty(st.info)) { skipped.noCoreList++; continue }
  addSpell(r.name, st, book, r.summary)
}

// 4b. Every other spell on the same book pages (cleric, druid, bard, paladin, ranger lists).
for (const [page, book] of [...pageBook].sort()) {
  for (const st of pageStats(page).values()) {
    // Page headings are often in capitals: "CURE LIGHT WOUNDS, MASS" -> "Cure Light Wounds, Mass"
    const name = st.name === st.name.toUpperCase() ? st.name.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/\b(Of|The|And|From|To|In|On|With|A|An|Or|By)\b/g, (w, _x, i) => (i === 0 ? w : w.toLowerCase())) : st.name
    if (isSeen(name)) continue
    // Reprints spelled differently ("Cloudwalkers" / "Cloud Walkers") are the same spell.
    if (!findExisting(name) && existingCompact.has(compact(name))) { skipped.existing++; continue }
    const over = takeOver(name, st)
    if (over) { addSpell(name, { ...st, info: over.levels }, book, summaryByName.get(slugify(name)) ?? over.summary); continue }
    if (isExisting(name)) { mergeLevels(name, st.info); continue }
    if (isEmpty(st.info)) { skipped.noCoreList++; continue }
    addSpell(name, st, book)
  }
}

// "Functions like X" spells list only what changes: fill missing stat lines from the base.
{
  const all = new Map<string, Spell>([...existingSpells, ...out].map((x) => [x.id, x]))
  // The SRD drops wizard names: "Mordenkainen's faithful hound" is "Mage's Faithful Hound",
  // "Bigby's interposing hand" is "Interposing Hand".
  const variants = (name: string) => {
    const n = name.replace(/,\s*$/, '').trim()
    const rest = n.replace(/^[A-Z][a-z]+'s\s+/i, '')
    return [n, rest, `Mage's ${rest}`]
  }
  const find = (name: string) => {
    for (const v of variants(name)) {
      const hit = all.get(slugify(v)) ?? (altId(v) ? all.get(altId(v)!) : undefined)
      if (hit) return hit
    }
    return undefined
  }
  const INHERIT = ['components', 'castingTime', 'range', 'target', 'area', 'effect', 'duration', 'savingThrow', 'spellResistance'] as const
  for (let pass = 0; pass < 3; pass++) {
    for (const sp of out) {
      const baseName = baseOf.get(sp.id)
      const base = baseName ? find(baseName) : undefined
      if (!base || base.id === sp.id) continue
      const hasTargeting = sp.target || sp.area || sp.effect
      for (const k of INHERIT) {
        if ((k === 'target' || k === 'area' || k === 'effect') && hasTargeting) continue
        const empty = k === 'components' ? sp.components.length === 0 : !sp[k]
        const has = k === 'components' ? base.components.length > 0 : !!base[k]
        if (empty && has) (sp as unknown as Record<string, unknown>)[k] = base[k]
      }
    }
  }
}

out.sort((a, b) => sortLevel(a) - sortLevel(b) || a.name.localeCompare(b.name))
const errors = validateSpellFile(out)
if (errors.length) {
  console.error(errors.slice(0, 30).join('\n'))
  process.exit(1)
}
writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n')
for (const f of existingFiles) if (f.dirty) writeFileSync(f.path, JSON.stringify(f.list, null, 1) + '\n')
console.log(`Added class levels from the book pages to ${levelsAdded} spells in earlier files; replaced ${replaced} that the pages put on the Sor/Wiz list.`)
const by = out.reduce<Record<string, number>>((m, s) => ((m[s.source] = (m[s.source] ?? 0) + 1), m), {})
console.log(`Wrote ${out.length} spells (${out.filter((s) => s.levels?.Wiz !== undefined).length} wizard). Skipped: ${skipped.existing} already in the app, ${skipped.notAllowed} from books not allowed, ${skipped.noCoreList} on no core class list.`)
if (skipped.noStats.length) console.log(`No stat block found (${skipped.noStats.length}): ${skipped.noStats.join('; ')}`)
console.log('By source:', JSON.stringify(Object.entries(by).sort((a, b) => b[1] - a[1])))
