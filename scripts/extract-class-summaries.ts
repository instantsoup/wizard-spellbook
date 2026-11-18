// Pulls one-line spell summaries from imarvintpa.com's class spell indexes, for spells that
// have no wizard-list summary (cleric, druid, bard, paladin, ranger spells).
//
//   node scripts/extract-class-summaries.ts <out.json> Clr.html Drd.html ...
//
// Each page is https://imarvintpa.com/dndlive/Index_Class_Desc.php?Class=Clr (and so on),
// saved to disk. The output is { "Spell Name": "Summary." }, for convert-dndtools.ts SUMMARIES.
import { readFileSync, writeFileSync } from 'node:fs'

const [out, ...pages] = process.argv.slice(2)
if (!out || !pages.length) {
  console.error('usage: node scripts/extract-class-summaries.ts <out.json> <page.html> ...')
  process.exit(1)
}
const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const summaries: Record<string, string> = {}
for (const page of pages) {
  const html = readFileSync(page, 'utf8')
  for (const m of html.matchAll(/<li><a href='spells\.php\?ID=\d+'>([^<]+)<\/a>:\s*([\s\S]*?)<\/li>/g)) {
    summaries[decode(m[1])] ??= decode(m[2])
  }
}
writeFileSync(out, JSON.stringify(summaries, null, 0) + '\n')
console.log(`Wrote ${Object.keys(summaries).length} summaries.`)
