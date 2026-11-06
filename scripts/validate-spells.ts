// Checks every spell file listed in public/data/spells/manifest.json.
//
//   npm run validate:spells
//
// Fails (exit 1) on: a listed file that is missing or not valid JSON, a spell that
// breaks the format (see docs/spell-format.md), or a duplicate id within one file.
// Warns on: a .json file that is not in the manifest, or an id used in several files
// (allowed: the later file in the manifest replaces the earlier spell).

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { validateSpellFile } from '../src/data/spell-schema.ts'

const dir = process.argv[2] ?? 'public/data/spells'
const errors: string[] = []
const warnings: string[] = []

let manifest: unknown
try {
  manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
} catch (e) {
  console.error(`manifest.json: ${(e as Error).message}`)
  process.exit(1)
}
if (!Array.isArray(manifest) || !manifest.every((f) => typeof f === 'string' && f.endsWith('.json'))) {
  console.error('manifest.json must be a JSON array of file names, e.g. ["srd-phb.json"]')
  process.exit(1)
}

const idSources = new Map<string, string>()
let total = 0
for (const file of manifest as string[]) {
  const path = join(dir, file)
  if (!existsSync(path)) {
    errors.push(`${file}: listed in manifest.json but the file does not exist`)
    continue
  }
  let data: unknown
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    errors.push(`${file}: not valid JSON (${(e as Error).message})`)
    continue
  }
  for (const e of validateSpellFile(data)) errors.push(`${file}: ${e}`)
  if (Array.isArray(data)) {
    total += data.length
    for (const s of data as { id?: string }[]) {
      if (!s?.id) continue
      const prev = idSources.get(s.id)
      if (prev && prev !== file) warnings.push(`${file}: "${s.id}" replaces the spell from ${prev}`)
      idSources.set(s.id, file)
    }
  }
}
for (const f of readdirSync(dir)) {
  if (f.endsWith('.json') && f !== 'manifest.json' && !(manifest as string[]).includes(f)) {
    warnings.push(`${f}: not listed in manifest.json, so the app will not load it`)
  }
}

for (const w of warnings) console.warn(`warning: ${w}`)
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`)
  console.error(`\n${errors.length} problem(s) found.`)
  process.exit(1)
}
console.log(`OK: ${(manifest as string[]).length} file(s), ${total} spell(s), ${idSources.size} unique.`)
