import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { levelLabel } from '../../components/schools'
import { SpellRow } from '../../components/SpellCard'
import { Button, Card, Chip, inputClass, Loading, Page } from '../../components/ui'
import { forgetSpell } from '../../data/characters'
import type { CharacterRecord, KnownSpellRecord } from '../../data/db'
import { useKnownSpells } from '../../data/hooks'
import { useSpells } from '../../data/spells'
import { freePickStatus, totalFreePicksRemaining, totalSpent } from '../../rules'

const METHOD_LABEL: Record<KnownSpellRecord['method'], string> = {
  'starting-cantrip': 'Starting cantrip',
  'starting-free': 'Starting spell',
  'levelup-free': 'Level-up pick',
  scroll: 'From a scroll',
  'other-book': "From another wizard's book",
  research: 'Researched',
  other: 'Other',
}

export function BookPage({ character }: { character: CharacterRecord }) {
  const known = useKnownSpells(character.id)
  const { byId, loading } = useSpells()
  const [level, setLevel] = useState<number>()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string>()

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (known ?? [])
      .map((k) => ({ k, spell: byId.get(k.spellId) }))
      .filter(({ spell }) => spell && (!q || spell.name.toLowerCase().includes(q)))
      .sort((a, b) => a.spell!.level - b.spell!.level || a.spell!.name.localeCompare(b.spell!.name))
  }, [known, byId, query])

  if (!known || loading) return <Loading />

  const levels = [...new Set(entries.map((e) => e.spell!.level))]
  const shown = entries.filter((e) => level === undefined || e.spell!.level === level)
  const free = totalFreePicksRemaining(character, known)
  const startingLeft = freePickStatus(character, known).find((s) => s.wizardLevel === 1)?.remaining ?? 0
  const missing = known.filter((k) => !byId.has(k.spellId))

  return (
    <Page
      title={character.name}
      subtitle={`Wizard ${character.wizardLevel}${character.specialty ? ` · ${character.specialty} specialist` : ''} · ${known.length} spells · ${totalSpent(known).toLocaleString()} gp spent`}
    >
      {free > 0 && (
        <Card className="mb-4 flex items-center justify-between gap-3 border-rubric/30">
          <p className="text-sm">
            <span className="font-semibold text-rubric">{free} free spell{free === 1 ? '' : 's'}</span> to choose.
          </p>
          <Link to={startingLeft > 0 ? '/setup/spells' : '/library'}>
            <Button variant="secondary">Choose</Button>
          </Link>
        </Card>
      )}

      {known.length > 0 && (
        <>
          <input className={`${inputClass} mb-2`} type="search" placeholder="Search your book" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            <Chip selected={level === undefined} onClick={() => setLevel(undefined)}>
              All
            </Chip>
            {levels.map((l) => (
              <Chip key={l} selected={level === l} onClick={() => setLevel(level === l ? undefined : l)}>
                {l === 0 ? 'Cantrips' : l}
              </Chip>
            ))}
          </div>
        </>
      )}

      {levels
        .filter((l) => level === undefined || l === level)
        .map((l) => (
          <section key={l} className="mb-4">
            <h2 className="mb-1 border-b border-leather/30 font-display text-lg text-leather">{levelLabel(l)}</h2>
            <ul>
              {shown
                .filter((e) => e.spell!.level === l)
                .map(({ k, spell }) => (
                  <SpellRow key={k.id} spell={spell!} open={openId === k.id} onToggle={() => setOpenId(openId === k.id ? undefined : k.id)}>
                    <p className="mt-3 rounded-md bg-parchment-dark/60 px-3 py-2 text-xs text-ink/70">
                      {METHOD_LABEL[k.method]}
                      {k.freePickLevel && k.method === 'levelup-free' ? ` (wizard level ${k.freePickLevel})` : ''} ·{' '}
                      {k.costGp + (k.extraCostGp ?? 0) ? `${(k.costGp + (k.extraCostGp ?? 0)).toLocaleString()} gp` : 'free'}
                      {k.note ? ` · ${k.note}` : ''}
                    </p>
                    <Button
                      variant="ghost"
                      className="mt-1 text-sm text-rubric"
                      onClick={async () => {
                        const refund = k.costGp + (k.extraCostGp ?? 0)
                        if (confirm(`Remove ${spell!.name} from your book?${refund ? ` Its ${refund.toLocaleString()} gp will no longer count toward gold spent.` : ''}`)) {
                          await forgetSpell(k.id)
                        }
                      }}
                    >
                      Remove from book
                    </Button>
                  </SpellRow>
                ))}
            </ul>
          </section>
        ))}

      {known.length === 0 && (
        <Card className="text-center">
          <p className="mb-3">Your book is empty.</p>
          <Link to="/setup/spells">
            <Button>Add starting spells</Button>
          </Link>
        </Card>
      )}
      {missing.length > 0 && (
        <p className="mt-4 text-xs text-rubric">
          {missing.length} spell(s) in your book are missing from the spell database: {missing.map((m) => m.spellId).join(', ')}.
        </p>
      )}
    </Page>
  )
}
