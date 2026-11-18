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
> `srd.json` is Open Game Content. `index-extra.json` is an index of spells from other
> books: name, stats, a one-line summary and book/page, but never full text. Don't add
> full spell text from non-open books here. To keep a spell private, use the app's
> **My spells → Import file**, which stores it only on your phone.

## A complete example

```json
[
  {
    "id": "orb-of-fire",
    "name": "Orb of Fire",
    "school": "Conjuration",
    "subschool": "Creation",
    "descriptors": ["Fire"],
    "levels": { "Sor": 4, "Wiz": 4, "Clr": 5 },
    "domains": { "Fire": 4 },
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
| `levels` | yes* | object | Level per class list, 0–9: `"Brd"`, `"Clr"`, `"Drd"`, `"Pal"`, `"Rgr"`, `"Sor"`, `"Wiz"`. A spell on the sorcerer/wizard list has both `Sor` and `Wiz`; a wizard-only spell has just `Wiz`. Each class only sees the spells on its own list. |
| `domains` | no | object | Cleric domain levels, for example `{"Fire": 4, "Sun": 4}`. |
| `level` | no | number | Older format: the Sor/Wiz level, read as `{"Sor": n, "Wiz": n}`. Still accepted (for imports and custom spells); bundled files use `levels`. |
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

\* Give `levels`, or `domains` for a domain-only spell, or the older `level`.

Any other field name is reported as an error, which catches typos such as
`"savingthrow"`.

## Rebuilding the SRD file

`srd.json` was generated once from the 3.5 SRD Markdown at
<https://github.com/olimot/srd-v3.5-md>:

```bash
git clone --depth 1 https://github.com/olimot/srd-v3.5-md /tmp/srd
npm run build:srd -- /tmp/srd/spells
```

The converter keeps every spell on a core class list (bard, cleric, druid, paladin, ranger,
sorcerer, wizard) or a cleric domain, with its levels for each. Wizard-only spells (such as
*Mage's Lucubration*) get just `Wiz`. For "functions like X" spells, it fills in the missing
stat lines from the base spell. It also adds summaries from the SRD class spell lists (the
Sor/Wiz list first) and checks every level against those lists; it reports two known
differences, *Mage's Lucubration* and *Mnemonic Enhancer*, where the Level line (wizard only)
is used.

## Converting another spell list

`scripts/convert-spell-list.ts` turns a third-party 3.5 spell list into this format. The
list must be a JSON array whose entries have `name`, `source: {abbr, page}`, `school`,
`subschool`, `descriptor`, `levels: {"Sor/Wiz": n, ...}`, `components` (text),
`castingTime`, `range`, `duration`, `savingThrow`, `spellResistance` and a one-line
`description`.

```bash
node scripts/convert-spell-list.ts list.json public/data/spells/srd.json my-spells.json
```

- Spells on a core class list or a cleric domain are kept; other classes in the list (Archivist
  "Arc", Wu Jen, prestige classes) are ignored. Domain names are in `scripts/lib/classes.ts`.
- Spells already in `srd.json` are skipped, so the full SRD text is never replaced by a summary.
- Non-standard components (Corrupt, Sacrifice, Abstinence, …) are kept as a note in the description.
- The result can be imported on a phone (**My spells → Import file**), or bundled as an
  index file in `public/` (as `index-extra.json` is). Lists like this usually include
  non-open books, so bundle summaries only, never full text.

## Building the book index (srd.dndtools.org)

`public/data/spells/index-books.json` comes from srd.dndtools.org:

```bash
# save the wizard list and the per-book pages it links to, then:
SUMMARIES=class-summaries.json node scripts/convert-dndtools.ts wizardSpells.html pages/ \
  public/data/spells/index-books.json public/data/spells/srd.json public/data/spells/index-extra.json
```

- `ALLOWED` in the script lists the books from the player's library.
- Only the school line and stat lines are taken from the book pages; the description is
  a one-line summary plus "Summary only. Full text: <book>".
- Wizard-list spells come first, with the list's summary. Every other spell on the same
  book pages that is on a core class list or domain is added too, with a summary from
  `SUMMARIES` when there is one. Build that file from imarvintpa.com's class indexes
  (`Index_Class_Desc.php?Class=Clr`, `Drd`, `Brd`, `Pal`, `Rgr`, saved as HTML):
  ```bash
  node scripts/extract-class-summaries.ts class-summaries.json Clr.html Drd.html Brd.html Pal.html Rgr.html
  ```
- Spells already in the earlier files are skipped, but the classes and domains the book page
  shows are added to them (`index-extra.json` only; `srd.json` is never changed). If the page
  puts a spell on the Sor/Wiz list that `index-extra.json` has only for other classes, the
  page's version replaces it.

## Rebuilding everything

The files are built in this order, then corrected:

```bash
node scripts/build-srd.ts /tmp/srd/spells
node scripts/convert-spell-list.ts spells.json public/data/spells/srd.json public/data/spells/index-extra.json
SUMMARIES=class-summaries.json node scripts/convert-dndtools.ts wizardSpells.html pages/ \
  public/data/spells/index-books.json public/data/spells/srd.json public/data/spells/index-extra.json
node scripts/apply-corrections.ts
npm run validate:spells
```

## Corrections from the source books

`data-corrections/<Book>.json` holds changes found by checking the bundled spells against the
player's own PDFs (the books are the source of truth). Each file lists:

These files came from checking **wizard** spells, so they only touch the sorcerer/wizard list:

- `updates`: a stat or school field and its value **as printed in the book** (`level` is the
  Sor/Wiz level);
- `renames`: spelling fixes (the spell id never changes, so books that already contain the
  spell keep working);
- `additions`: wizard spells that were missing, with stat lines and a one-line summary
  (the book's own spell-list line when it has one; never the spell's full text);
- `removals`: spells the book shows are not on the sorcerer/wizard list. The spell loses its
  Sor/Wiz level and stays for any other class that has it.

`SpellCompendium.json` is applied first, so for a reprinted spell its version wins. An
addition replaces a converter's version of the same spell (keeping its other class levels),
except for SRD spells, which only get the Sor/Wiz level.

Apply them (safe to run repeatedly) and check the result:

```bash
node scripts/apply-corrections.ts
npm run validate:spells
```

The converters above produced the original files; the corrections are applied on top. If a
converter is ever re-run, run `apply-corrections.ts` again afterwards.
