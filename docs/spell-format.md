# Spell file format

Spells live in **flat JSON files** in `public/data/spells/`. Each file is a JSON
array of spell objects. The app loads every file listed in
`public/data/spells/manifest.json`, in order.

## Adding spells

1. Create a file, for example `public/data/spells/spell-compendium.json`.
2. Add its name to `manifest.json`:
   ```json
   ["srd.json", "spell-compendium.json"]
   ```
3. Check it:
   ```bash
   npm run validate:spells
   ```
4. Commit and push. GitHub runs the same check before it deploys, and a bad file
   stops the deploy instead of breaking the app.

If two files use the same `id`, the file **later** in the manifest wins. You can use
this to correct an SRD spell without editing `srd.json`.

> **Public site warning:** everything in `public/` is published on GitHub Pages.
> Only put Open Game Content or your own homebrew there. For spells from other
> books, use the app's import feature (planned), which keeps them on your phone.

## A complete example

```json
[
  {
    "id": "orb-of-fire",
    "name": "Orb of Fire",
    "school": "Conjuration",
    "subschool": "Creation",
    "descriptors": ["Fire"],
    "level": 4,
    "components": ["V", "S"],
    "castingTime": "1 standard action",
    "range": "Close (25 ft. + 5 ft./2 levels)",
    "effect": "One orb of fire",
    "duration": "Instantaneous",
    "savingThrow": "Fortitude partial; see text",
    "spellResistance": "No",
    "summary": "Ranged touch, 1d6 fire/level (max 15d6).",
    "description": "An orb of fire about 3 inches across shoots from your palm...\n\nA second paragraph goes after a blank line. Use _underscores_ for spell names in italics.",
    "source": "Homebrew"
  }
]
```

## Fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | text | Unique, lowercase words joined by hyphens: `"orb-of-fire"`. Never change it after adding the spell to a book, because your book refers to spells by id. |
| `name` | yes | text | As displayed. The SRD style puts variants after a comma: `"Teleport, Greater"`. |
| `school` | yes | text | One of: `Abjuration`, `Conjuration`, `Divination`, `Enchantment`, `Evocation`, `Illusion`, `Necromancy`, `Transmutation`, `Universal`. |
| `subschool` | no | text | For example `"Creation"`, `"Summoning"`, `"Figment"`, `"Charm"`. |
| `descriptors` | yes | list | For example `["Fire"]`, `["Mind-Affecting", "Fear"]`. Use `[]` for none. |
| `level` | yes | number | The **Sor/Wiz** level, 0–9. |
| `components` | yes | list | Any of `"V"`, `"S"`, `"M"`, `"F"`, `"DF"`, `"XP"`. |
| `materialComponent` | no | text | Text of the material component. |
| `focus` | no | text | Text of the focus. |
| `xpCost` | no | text | Text of the XP cost. |
| `castingTime` | no | text | `"1 standard action"`, `"1 round"`, ... |
| `range` | no | text | |
| `target` | no | text | |
| `targetLabel` | no | text | Replaces the "Target" label, for example `"Target or Area"`. |
| `area` | no | text | |
| `effect` | no | text | |
| `duration` | no | text | Include `(D)` for dismissible. |
| `savingThrow` | no | text | Leave it out for Personal spells. |
| `spellResistance` | no | text | |
| `summary` | no | text | One line shown in spell lists. |
| `description` | yes | text | Markdown: blank line between paragraphs (`\n\n` in JSON), `_italics_`, `**bold**`. |
| `source` | yes | text | Book or origin: `"SRD"`, `"Spell Compendium"`, `"Homebrew"`. Used by the Source filter. |
| `page` | no | number | Page in the source book. |

Any other field name is reported as an error, which catches typos such as
`"savingthrow"`.

## Rebuilding the SRD file

`srd.json` was generated once from the 3.5 SRD Markdown at
<https://github.com/olimot/srd-v3.5-md>:

```bash
git clone --depth 1 https://github.com/olimot/srd-v3.5-md /tmp/srd
npm run build:srd -- /tmp/srd/spells
```

The converter keeps only Sor/Wiz spells, including the wizard-only ones (such as
*Mage's Lucubration*). For "functions like X" spells, it fills in the missing stat
lines from the base spell. It also adds summaries from the SRD spell list and checks
every level against that list.

## Converting another spell list

`scripts/convert-spell-list.ts` turns a third-party 3.5 spell list into this format. The
list must be a JSON array whose entries have `name`, `source: {abbr, page}`, `school`,
`subschool`, `descriptor`, `levels: {"Sor/Wiz": n, ...}`, `components` (text),
`castingTime`, `range`, `duration`, `savingThrow`, `spellResistance` and a one-line
`description`.

```bash
node scripts/convert-spell-list.ts list.json public/data/spells/srd.json my-spells.json
```

- Only spells with a Sor/Wiz level are kept. "Arc" is the Archivist list, not the wizard list.
- Spells already in `srd.json` are skipped, so the full SRD text is never replaced by a summary.
- Non-standard components (Corrupt, Sacrifice, Abstinence, …) are kept as a note in the description.
- Import the result on your phone with **My spells → Import file**. Don't put it in
  `public/`: lists like this usually include non-open books (Spell Compendium and so on),
  and everything in `public/` is published.
