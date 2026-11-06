// One-time converter: 3.5 SRD spell Markdown -> public/data/spells/srd.json
//
// Source: https://github.com/olimot/srd-v3.5-md (Open Game Content, OGL v1.0a)
//
//   git clone --depth 1 https://github.com/olimot/srd-v3.5-md /some/dir
//   node scripts/build-srd.ts /some/dir/spells
//
// Only spells with a Sor/Wiz level are kept.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCHOOLS, slugify, validateSpellFile, type School, type Spell } from '../src/data/spell-schema.ts'

const srcDir = process.argv[2]
const outFile = process.argv[3] ?? 'public/data/spells/srd.json'
if (!srcDir) {
  console.error('usage: node scripts/build-srd.ts <srd-v3.5-md/spells dir> [out.json]')
  process.exit(1)
}

const unescape = (s: string) => s.replace(/\\([[\]()*_#\\-])/g, '$1').trim()

// "**Label:** value" lines in the stat block
const FIELD_MAP: Record<string, keyof Spell> = {
  'Components': 'components',
  'Component': 'components',
  'Casting Time': 'castingTime',
  'Range': 'range',
  'Target': 'target',
  'Targets': 'target',
  'Area': 'area',
  'Effect': 'effect',
  'Duration': 'duration',
  'Saving Throw': 'savingThrow',
  'Spell Resistance': 'spellResistance',
}
// Combined labels are stored in `target` with the original label kept.
const COMBINED_TARGET_LABELS = new Set([
  'Target or Targets',
  'Target, Effect, or Area',
  'Target or Area',
  'Area or Target',
  'Target/Effect',
])

// "_Label:_ text" paragraphs pulled out of the description
const COMPONENT_PARAGRAPHS: Record<string, 'materialComponent' | 'focus' | 'xpCost'> = {
  'Material Component': 'materialComponent',
  'Arcane Material Component': 'materialComponent',
  'Focus': 'focus',
  'Arcane Focus': 'focus',
  'Wizard, Sorcerer, or Bard Focus': 'focus',
  'Focus (Trigger Object Only)': 'focus',
  'XP Cost': 'xpCost',
}

function parseSchoolLine(line: string) {
  // e.g. "Conjuration (Creation) \[Acid\]", "Illusion (Glamer)", "Evocation \[Fire, see text\]"
  const text = unescape(line)
  const m = text.match(/^([A-Za-z]+)\s*(?:\(([^)]+)\))?\s*(?:\[([^\]]+)\])?/)
  if (!m) throw new Error(`cannot parse school line: ${line}`)
  const school = m[1] as School
  if (!SCHOOLS.includes(school)) throw new Error(`unknown school "${m[1]}" in: ${line}`)
  return {
    school,
    subschool: m[2]?.trim(),
    descriptors: m[3] ? m[3].split(',').map((d) => d.trim()).filter(Boolean) : [],
  }
}

function parseSorWizLevel(levelText: string): number | undefined {
  const m = levelText.match(/\b(?:Sor\/Wiz|Wiz)\s+(\d)/) // a few spells are wizard-only ("Wiz 6")
  return m ? Number(m[1]) : undefined
}

function parseComponents(text: string): string[] {
  return text
    .split(',')
    .map((c) => c.trim().replace(/\/.*$/, '')) // "M/DF" -> "M"
    .map((c) => c.replace(/\s.*$/, ''))
    .filter((c) => ['V', 'S', 'M', 'F', 'DF', 'XP'].includes(c))
    .filter((c, i, all) => all.indexOf(c) === i)
}

type ParsedSpell = Omit<Spell, 'level'> & { level?: number }

function parseSpellBlock(name: string, lines: string[]): ParsedSpell | undefined {
  const paragraphs = lines
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const levelPara = paragraphs.find((p) => p.startsWith('**Level:**'))
  if (!levelPara) return undefined
  const level = parseSorWizLevel(levelPara) // undefined for non-wizard spells (kept for lookups)

  const { school, subschool, descriptors } = parseSchoolLine(paragraphs[0])
  const spell: ParsedSpell = {
    id: slugify(name),
    name,
    school,
    ...(subschool ? { subschool } : {}),
    descriptors: descriptors.map((d) => d.replace(/_/g, '')),
    level,
    components: [],
    description: '',
    source: 'SRD',
  }

  const description: string[] = []
  for (const p of paragraphs.slice(1)) {
    const field = p.match(/^\*\*([^*]+):\*\*\s*([\s\S]*)$/)
    if (field) {
      const [, label, value] = field
      const v = unescape(value)
      if (label === 'Level') continue
      if (FIELD_MAP[label] === 'components') spell.components = parseComponents(v)
      else if (FIELD_MAP[label]) (spell as unknown as Record<string, string>)[FIELD_MAP[label]] = v
      else if (COMBINED_TARGET_LABELS.has(label)) {
        spell.target = v
        spell.targetLabel = label
      } else description.push(p) // unusual labels stay in the text
      continue
    }
    const comp = p.match(/^_([^_]+):_\s*([\s\S]*)$/)
    if (comp && COMPONENT_PARAGRAPHS[comp[1]]) {
      const key = COMPONENT_PARAGRAPHS[comp[1]]
      const text = comp[2].trim()
      spell[key] = spell[key] ? `${spell[key]}\n\n${text}` : text
      continue
    }
    description.push(p)
  }
  spell.description = description.join('\n\n')
  return spell
}

function parseFile(md: string): ParsedSpell[] {
  const spells: ParsedSpell[] = []
  let name: string | undefined
  let buf: string[] = []
  const flush = () => {
    if (name) {
      const s = parseSpellBlock(name, buf)
      if (s) spells.push(s)
    }
  }
  for (const line of md.split('\n')) {
    const h = line.match(/^## (.+)$/)
    if (h) {
      flush()
      name = unescape(h[1])
      buf = []
    } else if (/^# /.test(line)) {
      flush()
      name = undefined
      buf = []
    } else if (name) {
      buf.push(line)
    }
  }
  flush()
  return spells
}

const files = readdirSync(srcDir).filter((f) => /^spells-.*\.md$/.test(f)).sort()
const parsed = files.flatMap((f) => parseFile(readFileSync(join(srcDir, f), 'utf8')))

// SRD "derived" spells ("This spell functions like _bull's strength_, except...") only list
// the stat lines that change. Fill the rest in from the base spell, following chains.
const INHERITED = ['components', 'materialComponent', 'focus', 'xpCost', 'castingTime', 'range',
  'target', 'targetLabel', 'area', 'effect', 'duration', 'savingThrow', 'spellResistance'] as const
const norm = (n: string) =>
  n.toLowerCase().replace(/[’']/g, "'").replace(/\s+'/g, "'").replace(/\s+/g, ' ').trim()
const byName = new Map<string, ParsedSpell>()
for (const s of parsed) {
  byName.set(norm(s.name), s)
  // "Teleport, Greater" is referred to in text as "greater teleport"
  const m = s.name.match(/^(.+), (Greater|Lesser|Mass)$/)
  if (m) byName.set(norm(`${m[2]} ${m[1]}`), s)
}
const baseName = (s: ParsedSpell) => {
  const m = s.description.match(/(?:functions (?:like|similarly to)|works like)\s+(?:an?\s+|the\s+)?_?([^_,.]+)/i)
  return m ? norm(m[1]) : undefined
}
const resolved = new Set<ParsedSpell>()
function resolve(s: ParsedSpell, depth = 0): void {
  if (resolved.has(s) || depth > 5) return
  resolved.add(s)
  const name = baseName(s)
  const base = name && byName.get(name)
  if (!base || base === s) return
  resolve(base, depth + 1)
  const hasTargeting = s.target || s.area || s.effect
  for (const key of INHERITED) {
    if (['target', 'targetLabel', 'area', 'effect'].includes(key) && hasTargeting) continue
    const empty = key === 'components' ? s.components.length === 0 : !s[key]
    if (empty && (key === 'components' ? base.components.length : base[key])) {
      ;(s as Record<string, unknown>)[key] = base[key]
    }
  }
}
parsed.forEach((s) => resolve(s))

const all = parsed.filter((s): s is Spell => s.level !== undefined)

// One-line summaries from the SRD's Sorcerer/Wizard spell list; also cross-checks levels.
const listMd = readFileSync(join(srcDir, 'spell-list-ii.md'), 'utf8')
const listSection = listMd.slice(listMd.indexOf('## Sorcerer/Wizard Spells'))
let listLevel = -1
const problems: string[] = []
const listed = new Set<ParsedSpell>()
for (const line of listSection.split('\n')) {
  const lh = line.match(/^### (\d)/)
  if (lh) listLevel = Number(lh[1])
  const entry = line.match(/^\*\*(.+?):\*\*\s*(.*)$/)
  if (!entry || listLevel < 0) continue
  const listName = unescape(entry[1]).replace(/<sup>.*?<\/sup>/g, '').replace(/[*_]/g, '').trim()
  // "Protection from Chaos/Evil/Good/Law" covers four spells
  const grouped = listName.match(/^(.* )(Chaos\/Evil\/Good\/Law)$/)
  const names = grouped ? grouped[2].split('/').map((a) => grouped[1] + a) : [listName]
  for (const n of names) {
    const spell = byName.get(norm(n))
    if (!spell) {
      problems.push(`list entry not found: ${n}`)
      continue
    }
    listed.add(spell)
    if (spell.level !== listLevel) problems.push(`${spell.name}: level ${spell.level} but list says ${listLevel}`)
    spell.summary = unescape(entry[2])
  }
}
for (const s of all) if (!listed.has(s)) problems.push(`not in Sor/Wiz list: ${s.name}`)
if (problems.length) console.warn('Spell list cross-check:\n  ' + problems.join('\n  '))
all.sort((a, b) => a.name.localeCompare(b.name))

const errors = validateSpellFile(all)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
writeFileSync(outFile, JSON.stringify(all, null, 2) + '\n')

const byLevel = all.reduce<Record<number, number>>((acc, s) => ((acc[s.level] = (acc[s.level] ?? 0) + 1), acc), {})
console.log(`Wrote ${all.length} Sor/Wiz spells to ${outFile}`)
console.log('By level:', JSON.stringify(byLevel))
