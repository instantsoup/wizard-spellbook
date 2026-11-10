// Builds an index of extra wizard spells from srd.dndtools.org pages.
//
//   node scripts/convert-dndtools.ts <wizardSpells.html> <pages-dir> <out.json> [existing.json ...]
//
// <wizardSpells.html> is .../classSpellLists/wizardSpells.html (one row per spell: source,
// school, name, one-line summary). <pages-dir> holds the linked per-book pages
// (.../spells/spells/spellsCMage.html and so on), which give each spell's school line and
// stat block. Only those are kept (no spell text): the summary comes from the list.
//
// Kept: spells on the Sorcerer/wizard list (per the stat block) from ALLOWED books that
// aren't already in any of the existing spell files (matched by id, so existing data wins).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { slugify, validateSpellFile, SCHOOLS, type School, type Spell } from '../src/data/spell-schema.ts'

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
interface Stats { school: School; subschool?: string; descriptors: string[]; level?: number; fields: Record<string, string>; baseName?: string }
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
      // "Sorcerer/wizard 3", "Sor/Wiz 3" or "sorcerer 7/wizard 7"; plain "Sorcerer 3" is sorcerer-only.
      const lv = fields.Level ?? ''
      const wm = lv.match(/Sor(?:cerer)?\/wiz(?:ard)?\s+(\d)/i) ?? lv.match(/\bwizard\s+(\d)/i)
      const wiz = wm
      const key = slugify(name)
      // "This spell functions like summon undead I, except ..." / "As manifest dragon heritage, except ..."
      const body = text(rest.slice(0, 3000))
      const baseName = (
        body.match(/functions (?:like|as|identically to)\s+(?:the |an? )?([A-Za-z' ,]+?)\s*(?:,|\(|\s+except|\s+spell\b|\.|\s+but\b)/i) ??
        body.match(/\bAs ([a-z][A-Za-z' ,]+?)\s*(?:,|\()\s*except/)
      )?.[1]?.trim()
      if (!map.has(key)) {
        map.set(key, {
          school: sm[1] as School,
          ...(sm[2] ? { subschool: sm[2].trim() } : {}),
          descriptors: sm[3] ? sm[3].split(',').map((d) => d.trim()).filter((d) => d && !/see text/i.test(d)) : [],
          level: wiz ? Number(wiz[1] ?? wiz[2]) : undefined,
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
for (const p of existingPaths) for (const s of JSON.parse(readFileSync(p, 'utf8')) as Spell[]) { existing.add(s.id); existingSpells.push(s) }
const baseOf = new Map<string, string>() // new spell id -> base spell name
const altId = (name: string) => {
  const m = name.match(/^(Greater|Lesser|Least|Mass|Superior|Improved) (.+)$/i)
  return m ? slugify(`${m[2]}, ${m[1]}`) : undefined
}

const COMPONENT_ORDER = ['V', 'S', 'M', 'F', 'DF', 'XP']
const skipped = { existing: 0, notAllowed: 0, notWizard: 0, noStats: [] as string[], notWizardNames: [] as string[] }
const out: Spell[] = []
const seen = new Set<string>()
for (const r of rows) {
  const id = slugify(r.name)
  if (existing.has(id) || (altId(r.name) && existing.has(altId(r.name)!))) { skipped.existing++; continue }
  const book = ALLOWED[r.source]
  if (!book) { skipped.notAllowed++; continue }
  if (/\(Sorcerer only\.?\)/i.test(r.summary)) { skipped.notWizard++; continue }
  if (seen.has(id)) continue
  // Pages sometimes name variants "Wings of Air, Greater" where the list says "Greater Wings of Air".
  const stats = pageStats(r.page)
  const st = stats.get(id) ?? stats.get(slugify(r.anchor)) ?? (altId(r.name) ? stats.get(altId(r.name)!) : undefined)
  if (!st) { skipped.noStats.push(`${r.name} (${r.page})`); continue }
  if (st.level === undefined) {
    skipped.notWizard++
    skipped.notWizardNames.push(`${r.name} [${r.source}] Level: ${st.fields.Level ?? '?'}`)
    continue
  }
  const f = st.fields
  const components = [...new Set((f.Components ?? f.Component ?? '').split(',').map((c) => c.trim().split(/[/\s]/)[0]).filter((c) => COMPONENT_ORDER.includes(c)))]
    .sort((a, b) => COMPONENT_ORDER.indexOf(a) - COMPONENT_ORDER.indexOf(b))
  const summary = r.summary.replace(/\s*\((Wizard|Sorcerer) only\.?\)\s*$/i, '').trim()
  const target = f.Target ?? f.Targets ?? f['Target or Area'] ?? f['Target, Effect, or Area'] ?? f['Area or Target']
  out.push({
    id,
    name: r.name.replace(/’/g, "'"),
    school: st.school,
    ...(st.subschool ? { subschool: st.subschool } : {}),
    descriptors: st.descriptors,
    level: st.level,
    components,
    ...(f['Casting Time'] ? { castingTime: f['Casting Time'] } : {}),
    ...(f.Range ? { range: f.Range } : {}),
    ...(target ? { target } : {}),
    ...(f.Area ? { area: f.Area } : {}),
    ...(f.Effect ? { effect: f.Effect } : {}),
    ...(f.Duration ? { duration: f.Duration } : {}),
    ...(f['Saving Throw'] ? { savingThrow: f['Saving Throw'] } : {}),
    ...(f['Spell Resistance'] ? { spellResistance: f['Spell Resistance'] } : {}),
    summary,
    description: `${summary}\n\nSummary only. Full text: ${book}.`,
    source: book,
  })
  seen.add(id)
  if (st.baseName) baseOf.set(id, st.baseName)
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

out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
const errors = validateSpellFile(out)
if (errors.length) {
  console.error(errors.slice(0, 30).join('\n'))
  process.exit(1)
}
writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n')
const by = out.reduce<Record<string, number>>((m, s) => ((m[s.source] = (m[s.source] ?? 0) + 1), m), {})
console.log(`Wrote ${out.length} spells. Skipped: ${skipped.existing} already in the app, ${skipped.notAllowed} from books not allowed, ${skipped.notWizard} not on the wizard list.`)
if (process.env.VERBOSE) console.log('Not on the wizard list:\n  ' + skipped.notWizardNames.join('\n  '))
if (skipped.noStats.length) console.log(`No stat block found (${skipped.noStats.length}): ${skipped.noStats.join('; ')}`)
console.log('By source:', JSON.stringify(Object.entries(by).sort((a, b) => b[1] - a[1])))
