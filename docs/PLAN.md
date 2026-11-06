# Wizard's Spellbook — D&D 3.5e — Coding Plan

A phone-first app that works like a wizard's spellbook during play: add spells from a
spell database, track the gold that costs, and prepare each day's spells within the
3.5e rules.

**Decisions made**
- Installable web app (PWA), hosted on **GitHub Pages**.
- Spell data starts with the **PHB / SRD** spells. More spells can be added later as
  **flat JSON files**.
- **No metamagic.**
- The character uses the **Eidetic Spellcasting** alternative class feature. Players
  roll Spellcraft at the table before adding a spell, so the app only records spells
  that were learned successfully. It does not track rolls, DCs or failures.
- The 100-page limit and "pages used" counter are not needed now (see section 10).

---

## 1. Scope

**Version 1**
1. Character setup: wizard level, Intelligence, specialist school and prohibited schools.
2. Spell database: searchable and filterable by level, school, subschool, descriptor,
   components and source. Spells from prohibited schools are greyed out.
3. Adding spells: put a spell into the book with checks on prohibited schools,
   spell level and free picks, and track the **gold spent**.
4. Browsing the book: a book-like view grouped by spell level, with the full spell text.
5. Daily preparation: fill the slots for each level (base, Int bonus and specialist
   slots), with checks on what may go in each slot.
6. At the table: tap a prepared spell to mark it cast, then "Rest" to start a new day.
7. Works offline and installs on Android. Data stays on the device, with JSON export
   and import for backups.

**Not in v1:** metamagic, sorcerers and other classes, multiclass caster levels,
prestige classes that advance casting. Optional later features are listed in section 10.

---

## 2. Rules reference (what the rules engine must use)

> Source: the 3.5 PHB, Wizard chapter and Table 1-1. Rules that tables often play
> differently become **[house-rule toggle]** settings.

### 2.1 Spells per day (base slots), PHB Table 3-18

| Lvl | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|----|---|---|---|---|---|---|---|---|---|---|
| 1  | 3 | 1 | – | – | – | – | – | – | – | – |
| 2  | 4 | 2 | – | – | – | – | – | – | – | – |
| 3  | 4 | 2 | 1 | – | – | – | – | – | – | – |
| 4  | 4 | 3 | 2 | – | – | – | – | – | – | – |
| 5  | 4 | 3 | 2 | 1 | – | – | – | – | – | – |
| 6  | 4 | 3 | 3 | 2 | – | – | – | – | – | – |
| 7  | 4 | 4 | 3 | 2 | 1 | – | – | – | – | – |
| 8  | 4 | 4 | 3 | 3 | 2 | – | – | – | – | – |
| 9  | 4 | 4 | 4 | 3 | 2 | 1 | – | – | – | – |
| 10 | 4 | 4 | 4 | 3 | 3 | 2 | – | – | – | – |
| 11 | 4 | 4 | 4 | 4 | 3 | 2 | 1 | – | – | – |
| 12 | 4 | 4 | 4 | 4 | 3 | 3 | 2 | – | – | – |
| 13 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | 1 | – | – |
| 14 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 2 | – | – |
| 15 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | 1 | – |
| 16 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 2 | – |
| 17 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | 1 |
| 18 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 2 |
| 19 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 |
| 20 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |

Store this as a data table in code, not as a formula.

### 2.2 Intelligence rules
- `intMod = floor((Int - 10) / 2)`.
- **Minimum Int to prepare or cast:** a spell of level L needs Int ≥ 10 + L. If Int is
  too low, the slots for that level exist but can't be used. The UI shows them locked.
- **Bonus spells (Table 1-1):** for spell level L from 1 to 9, `bonus = intMod >= L ? floor((intMod - L) / 4) + 1 : 0`.
  Cantrips never get bonus spells. Bonus spells only apply to levels the wizard
  already has a base slot for.
- Effective Int = base Int + enhancement (for example a Headband of Intellect) +
  inherent bonuses. Store each part separately so the UI can show where the number
  comes from.

### 2.3 Specialist wizards
- Schools: Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion,
  Necromancy, Transmutation. **Universal** spells can't be the specialty and can't be
  prohibited.
- A specialist gets **one extra slot for each spell level they can cast, including 0**.
  Only a spell from the specialty school can fill it.
- Prohibited schools: two, which can't include Divination. A Divination specialist
  gives up only one.
- Spells from prohibited schools can't be added or prepared. The database shows them
  greyed out.

### 2.4 Known spells (Eidetic Spellcasting)
- **Starting spells (level 1):** all 0-level Sor/Wiz spells except prohibited ones,
  plus **3 + intMod** 1st-level spells of the player's choice. All free.
- **On each new wizard level:** **2 free spells** of any level the wizard can cast at
  the new level.
  - Total free picks = `3 + intMod(at level 1) + 2 × (level − 1)`. Keep the level-1
    Int mod on the character record, because later Int increases don't change it.
  - Track each free pick against the level it came from ("gained at level 5"), so the
    app can check that its spell level is legal for that wizard level.
- **Other spells learned** (from a scroll, another wizard's book, research and so on):
  the player has already made the Spellcraft roll, so the app just records the spell.
  - **Cost:** by default **100 gp × spell level**, with cantrips counting as level 1.
    Eidetic Spellcasting keeps the standard gold cost (flavoured as incense or
    mental mapping) and skips writing on pages. The rate per level is a setting, and
    the cost can be changed on each spell.
  - There is an extra cost field, for example for buying the scroll.
- **Spell levels above what the wizard can cast:** **[house-rule toggle]**, default
  "warn but allow".

### 2.5 Preparing spells
- The wizard needs 8 hours of rest, then 1 hour of study. The app records this as a
  "Rest & Prepare" action that starts a new day.
- Any known spell can fill a slot of its own level or a higher one.
- The same spell can be prepared more than once.
- Slots can be left open and filled later in the day.

---

## 3. Spell data (expandable flat JSON)

**Starting data:** the 3.5 System Reference Document (SRD), which covers the PHB
spells (about 360 Sor/Wiz spells) and is Open Game License content, so it can be
bundled with the app.

**How the data is stored:** every spell source is a **flat JSON file**: an array of
`Spell` objects that all follow the same format.
```
public/data/spells/
  manifest.json        # ["srd.json", "spell-compendium.json", ...]
  srd.json         # generated once from the SRD
  my-homebrew.json     # added by hand later, same format
```
- At startup the app loads every file listed in `manifest.json` and merges them by `id`.
- **Adding spells later, three ways:**
  1. Add a JSON file to the repo and list it in `manifest.json`. It ships with the
     next deploy.
  2. **Import a JSON file in the app** (Settings → Import spells). It is stored on the
     device and merged with the bundled spells.
  3. A **"Custom spell" form** in the app, with an "export my custom spells as JSON"
     button so form entries can become a repo file.
- A `scripts/validate-spells.ts` check (also run automatically on GitHub) catches
  missing fields, unknown schools, duplicate ids and bad level maps.
- A short `docs/spell-format.md` explains the format so spells can be added by hand.

**Spell record**
```ts
interface Spell {
  id: string;                 // slug, unique across all files, e.g. "fireball"
  name: string;
  school: School;             // "Evocation"
  subschool?: string;         // "Creation", "Summoning", "Figment"...
  descriptors: string[];      // ["Fire"]
  level: number;              // Sor/Wiz level 0–9 (other classes' levels not needed)
  components: string[];       // ["V","S","M"]
  materialComponent?: string;
  castingTime: string;
  range: string;
  target?: string; area?: string; effect?: string;
  duration: string;
  savingThrow: string;
  spellResistance: string;
  description: string;        // plain text / light markdown
  source: string;             // "SRD", "Spell Compendium", "Homebrew"
  page?: number;
}
```
The format is deliberately simple: a `level` number instead of a map of class
levels, and `components` as a list of strings. That makes it easy to write by hand.

**Pipeline (done):** `scripts/build-srd.ts` converts the 3.5 SRD Markdown at
github.com/olimot/srd-v3.5-md into `srd.json`: 377 Sor/Wiz spells, including
wizard-only ones. It fills in "functions like X" stat lines from the base spell, adds
one-line summaries from the SRD spell list, and checks every level against that list.
The field reference is in `docs/spell-format.md`. Spell data is labelled
`source: "SRD"`, because the OGL treats book names like "Player's Handbook" as
Product Identity.

The `summary` field (optional) was added during Phase 0.

---

## 4. Tech stack

| Concern | Choice |
|---|---|
| App type | **PWA** (installable from the Android browser, works offline) |
| Framework | **React 18 + TypeScript + Vite** |
| UI | **Tailwind CSS** + a few hand-built components |
| Routing | React Router (hash routing, which works on GitHub Pages without extra setup) |
| State | Zustand for UI state; the on-device database is the source of truth |
| Storage | **IndexedDB via Dexie.js** |
| Search | **MiniSearch** (fuzzy search over names and descriptions) |
| Offline / install | `vite-plugin-pwa` (caches the app and all spell JSON) |
| Testing | **Vitest** for the rules engine; Playwright smoke tests at phone size |
| Hosting / CI | **GitHub repo + GitHub Actions → GitHub Pages** (each push to `main` runs tests, checks the spell files, builds and deploys) |

---

## 5. Architecture

```
src/
  rules/                 # PURE functions, no React, fully unit tested
    tables.ts            # spells-per-day table, bonus spell formula
    slots.ts             # computeSlots(character) -> SlotPlan
    known.ts             # canLearn(), learnCost(), freePickAllowance()
    preparation.ts       # validatePreparation(), canFillSlot()
    houseRules.ts        # toggle definitions + defaults
  data/
    db.ts                # Dexie schema & migrations
    spells.ts            # load manifest + JSON files, merge imported/custom, index
    backup.ts            # export/import JSON (character data + custom spells)
  features/
    characters/  library/  spellbook/  prepare/  today/  ledger/  settings/
  components/            # SpellCard, SpellDetailSheet, FilterChips, SlotPip, BottomNav...
public/data/spells/      # flat JSON spell files + manifest
scripts/                 # build-srd.ts, validate-spells.ts
```
The main rule: every rules decision lives in `src/rules/` as a pure function. The UI
never repeats a rule.

---

## 6. Data model (IndexedDB / Dexie)

```ts
interface Character {
  id: string;
  name: string;
  wizardLevel: number;                 // 1–20
  int: { base: number; enhancement: number; inherent: number };
  intModAtLevel1: number;              // locks starting free-spell count
  specialty?: School;                  // undefined = generalist
  prohibited: School[];                // validated per §2.3
  houseRules: Partial<HouseRules>;
  createdAt: number; updatedAt: number;
}

type AcquisitionMethod =
  | "starting-cantrip" | "starting-free" | "levelup-free"
  | "scroll" | "other-book" | "research" | "other";

interface KnownSpell {                 // an entry in the book
  id: string; characterId: string; spellId: string;
  spellLevel: number;                  // snapshot at time of learning
  method: AcquisitionMethod;
  freePickLevel?: number;              // which wizard level granted this free pick
  costGp: number;                      // 0 if free; default 100 × max(1, level)
  extraCostGp?: number;                // e.g. buying the scroll
  note?: string;                       // "From the lich's tome, session 12"
  addedAt: number;
}

interface PreparedDay {
  id: string; characterId: string;
  label?: string;                      // "Day 14 — Into the Barrow"
  startedAt: number;
  isCurrent: boolean;
  slots: PreparedSlot[];
}

interface PreparedSlot {
  slotLevel: number;                   // 0–9
  kind: "base" | "bonus" | "specialist";
  spellId?: string;                    // empty = left open
  expended: boolean;
}

interface PrepTemplate {               // saved loadouts: "Dungeon crawl", "Travel day"
  id: string; characterId: string; name: string;
  picks: { slotLevel: number; kind: PreparedSlot["kind"]; spellId: string }[];
}

interface LedgerEntry {                // other spell-related costs, entered by hand
  id: string; characterId: string; amountGp: number; label: string; at: number;
}

interface ImportedSpell extends Spell { origin: "imported" | "custom"; }
```
**Total spent** = the sum of `costGp + extraCostGp` over the book's spells, plus any
manual ledger entries. It is calculated when shown, not stored.

---

## 7. Screens (mobile-first, bottom tab bar)

Bottom navigation has five tabs: **Book · Library · Prepare · Today · More**

1. **Character setup** (first run, and under More)
   - Name, level, Int (base, enhancement, inherent), specialty, prohibited schools.
     Invalid combinations are blocked with an explanation.
   - Finishing setup adds the cantrips automatically, then the player picks the
     3 + Int mod 1st-level spells.
   - Raising the level shows a "2 free spells available" badge that leads into the
     Library.

2. **Book**
   - Parchment styling, with chips for 0th to 9th level.
   - Each spell shows its name, a school colour or icon, its components and a short
     summary. Tapping it opens a bottom sheet with the full stat block.
   - The header shows the number of spells known and the total gold spent.
   - Search within the book, and an option to group by school.

3. **Library** (spell database)
   - Search bar and filter chips: **Level (0–9, multi-select)**, **School**,
     Subschool, Descriptor, Components, Source, "Not known yet", "Castable now".
   - Prohibited spells are greyed out with a lock icon. Known spells are marked.
   - The **"Add to book"** sheet has:
     - How it was learned: free pick (shows the free picks left for each level),
       scroll, another book, research or other.
     - The cost, filled in automatically (for example "3rd level · 300 gp") and
       editable, plus an extra-cost field and a note.
     - Warnings: spell level above what the wizard can cast (house rule), or Int too
       low to prepare it.
   - **"+ Custom spell"** button.

4. **Prepare**
   - Spell levels are stacked vertically. Each level shows its slots as pips:
     Base, Bonus (Int) or Specialist (in the school's colour).
   - Tapping a slot opens a picker listing only legal known spells: spells of that
     level or lower, and only specialty-school spells for a specialist slot.
   - Leaving a slot open is allowed. "Load template" and "Save as template" are
     available.
   - **"Rest & Prepare"** starts a new day, with the option to keep yesterday's picks.

5. **Today**
   - Prepared spells grouped by level as large tappable cards. Tapping marks one
     cast, with undo. Long-pressing shows details.
   - A counter shows what's left, for example "Level 3: 1 of 3 left".
   - Open slots can be filled from here.
   - The screen stays awake (Wake Lock API) while this tab is open.

6. **More**
   - **Ledger:** every learned spell with its cost and method, plus manual entries,
     with totals.
   - **Settings:** house-rule toggles, gp per spell level, theme (parchment or dark),
     import spells JSON, export custom spells, back up and restore character data,
     about (OGL notice).

**Look and feel:** a parchment-and-ink theme with a serif heading font, a dark
"candlelight" theme, consistent school colours and glyphs, and tap targets of at
least 44 px.

---

## 8. House-rule settings (defaults in **bold**)

- Allow learning spells above the castable level: off / **warn** / allow.
- Gold per spell level for learned (non-free) spells: **100 gp**. Cantrips count as
  level 1.
- Specialist bonus slot applies to cantrips: **yes**.
- Int enhancement counts toward bonus spells: **yes**.

---

## 9. Build phases

**Phase 0 — Setup and data**
- Create the GitHub repo. Scaffold Vite + React + TypeScript + Tailwind + PWA +
  Vitest, and add a GitHub Actions workflow that deploys to Pages.
- Write `build-srd.ts` → `srd.json`, plus `validate-spells.ts` and
  `docs/spell-format.md`.
- Deploy a placeholder page and confirm it installs on the Android phone.

**Phase 1 — Rules engine (tests first)** ✅ done
- `src/rules/`: `tables.ts` (Table 3-18 and Table 1-1), `character.ts` (Int totals,
  specialist and prohibited-school checks), `slots.ts` (base, bonus and specialist
  slots, minimum-Int lock), `known.ts` (free picks for each level, `canLearn`,
  costs, starting cantrips), `preparation.ts` (slot checks, candidate lists, day
  validation, carry-over, cast tracking) and `houseRules.ts`.
- 76 tests, covering 97% of lines. Run `npm test`, or `npm run coverage`.

**Phase 2 — Storage and character setup**
- Dexie schema, character create and edit, the starting-spells flow, backup and
  restore.

**Phase 3 — Library and adding spells**
- Spell loading from the manifest, merged with imported spells. Virtualized list,
  search, filters, detail sheet, Add to book sheet, custom spell form, spell import
  and export.

**Phase 4 — Book view and ledger**

**Phase 5 — Preparation and Today**
- Slot grid, slot picker with checks, templates, Rest & Prepare, cast tracker, wake lock.

**Phase 6 — Polish and release v1**
- Theme, school icons, empty states, a Lighthouse PWA check, Playwright smoke tests
  at 390 × 844, and the OGL notice.

---

## 10. Possible later options (not needed now)

- **Physical spellbook mode** (for a wizard without Eidetic Spellcasting):
  - Pages: 1 per spell level, with cantrips taking 1 page.
  - A 100-page capacity and a "pages used" counter.
  - Several books (travelling, backup, Boccob's Blessed Book).
  - Rules for rebuilding a lost book.
- **Spellcraft tracking:** record the DC (15 + spell level, +2 for the specialty
  school), the roll and failed attempts, and block a retry until a new Spellcraft rank.
- Scribing time (24 hours per spell).
- Metamagic feats, Spell Mastery, Ring of Wizardry, Pearl of Power.
- Scroll inventory and the Scribe Scroll feat.
- A native Android APK built with Capacitor.
- Sorcerers, other classes, multiclass support.

---

## 11. Risks and open questions

1. **Data loss:** the browser can clear on-device storage. Mitigations: request
   persistent storage and show a regular "back up" reminder.
2. **Copyrighted spells in the repo:** spells from non-SRD books should stay in
   imported files on the device or in a **private** repo, not on a public GitHub Pages
   site.
