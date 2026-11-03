# Wizard's Spellbook (D&D 3.5e)

A phone-first, installable web app (PWA) for a 3.5e wizard. You add spells from a
filterable spell database, it tracks the gold spent learning them, and you prepare
each day's spells within the rules (base, Int bonus and specialist slots).

- Live site: https://instantsoup.github.io/wizard-spellbook/
- Plan: [docs/PLAN.md](docs/PLAN.md)

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # rules-engine unit tests (Vitest)
npm run build    # production build to dist/
```

Every push to `main` is tested, built and deployed to GitHub Pages by
`.github/workflows/deploy.yml`.

## Spell data

Spells are flat JSON files in `public/data/spells/`, listed in `manifest.json`.
Add a file in the same format and list it in the manifest to add more spells.

Spell content from the System Reference Document is Open Game Content under the
Open Game License v1.0a.
