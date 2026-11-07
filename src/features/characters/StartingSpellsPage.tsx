import { SchoolIcon } from '../../components/SchoolIcon'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SCHOOL_STYLE } from '../../components/schools'
import { SpellRow } from '../../components/SpellCard'
import { Button, Card, Chip, inputClass, Loading, Messages, Page } from '../../components/ui'
import { addStartingCantrips, learnSpells } from '../../data/characters'
import { useActiveCharacter, useKnownSpells } from '../../data/hooks'
import { useSpells } from '../../data/spells'
import { freePickStatus, isProhibited, type School } from '../../rules'

export function StartingSpellsPage() {
  const navigate = useNavigate()
  const character = useActiveCharacter()
  const known = useKnownSpells(character?.id)
  const { spells, loading, error } = useSpells()
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [school, setSchool] = useState<School>()
  const [openId, setOpenId] = useState<string>()
  const [errors, setErrors] = useState<string[]>([])
  const cantripsDone = useRef(false)

  // Cantrips are automatic: add them once spells and the character are loaded.
  useEffect(() => {
    if (!character || !spells.length || known === undefined || cantripsDone.current) return
    cantripsDone.current = true
    void addStartingCantrips(character, spells)
  }, [character, spells, known])

  const knownIds = useMemo(() => new Set((known ?? []).map((k) => k.spellId)), [known])
  const cantrips = spells.filter((s) => s.level === 0 && knownIds.has(s.id))
  const firstLevel = useMemo(() => {
    if (!character) return []
    const q = query.trim().toLowerCase()
    return spells.filter(
      (s) =>
        s.level === 1 &&
        !isProhibited(character, s.school) &&
        !knownIds.has(s.id) &&
        (!school || s.school === school) &&
        (!q || s.name.toLowerCase().includes(q) || s.summary?.toLowerCase().includes(q)),
    )
  }, [spells, character, knownIds, query, school])

  if (character === undefined || known === undefined || loading) return <Loading />
  if (error) return <Page title="Starting spells"><Messages errors={[error]} /></Page>
  if (!character) return null

  const status = freePickStatus(character, known).find((s) => s.wizardLevel === 1)!
  const remaining = status.remaining - selected.length
  const toggle = (id: string) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : remaining > 0 ? [...sel, id] : sel))

  const save = async () => {
    const items = selected.map((id) => ({ spell: spells.find((s) => s.id === id)!, req: { method: 'starting-free' as const } }))
    const result = await learnSpells(character, items)
    if (!result.ok) return setErrors(result.errors)
    navigate('/book', { replace: true })
  }

  return (
    <Page title="Starting spells" subtitle={character.name}>
      <Card className="mb-4">
        <p className="text-sm">
          <span className="font-semibold">{cantrips.length} cantrips</span> are in your book: every 0-level spell you can learn.
        </p>
        <p className="mt-2 text-sm">
          Choose <span className="font-semibold">{status.granted}</span> free 1st-level spells (3 + your 1st-level Int
          modifier).
          {character.wizardLevel > 1 && ' Your level-up picks and any spells you paid for are added from the Library.'}
        </p>
      </Card>

      {status.remaining === 0 ? (
        <Card className="text-center">
          <p className="mb-3">Your starting spells are all chosen.</p>
          <Button onClick={() => navigate('/book', { replace: true })}>Open your book</Button>
        </Card>
      ) : (
        <>
          <input
            className={`${inputClass} mb-2`}
            placeholder="Search 1st-level spells"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
          />
          <div className="mb-2 flex flex-wrap gap-1.5">
            {Object.keys(SCHOOL_STYLE)
              .filter((s) => !isProhibited(character, s as School) && s !== 'Universal')
              .map((s) => (
                <Chip key={s} selected={school === s} color={SCHOOL_STYLE[s as School].color} onClick={() => setSchool(school === s ? undefined : (s as School))}>
                  <span className="inline-flex items-center gap-1">
                    <SchoolIcon school={s as School} />
                    {SCHOOL_STYLE[s as School].abbr}
                  </span>
                </Chip>
              ))}
          </div>
          <ul>
            {firstLevel.map((s) => {
              const isSel = selected.includes(s.id)
              return (
                <SpellRow
                  key={s.id}
                  spell={s}
                  open={openId === s.id}
                  onToggle={() => setOpenId(openId === s.id ? undefined : s.id)}
                  aside={
                    <button
                      type="button"
                      aria-label={`${isSel ? 'Remove' : 'Choose'} ${s.name}`}
                      aria-pressed={isSel}
                      disabled={!isSel && remaining <= 0}
                      onClick={() => toggle(s.id)}
                      className={`size-11 rounded-full border-2 text-xl disabled:opacity-25 ${isSel ? 'border-leather bg-leather text-parchment' : 'border-leather/50 text-leather'}`}
                    >
                      {isSel ? '✓' : '+'}
                    </button>
                  }
                />
              )
            })}
          </ul>
          {firstLevel.length === 0 && <p className="py-6 text-center text-ink/60">No spells match.</p>}

          <div className="fixed inset-x-0 bottom-14 z-10 border-t border-ink/15 bg-parchment/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
            <div className="mx-auto max-w-xl space-y-2">
              <Messages errors={errors} />
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => navigate('/book', { replace: true })}>
                  Later
                </Button>
                <Button className="flex-1" disabled={!selected.length} onClick={save}>
                  Add {selected.length || ''} spell{selected.length === 1 ? '' : 's'} · {remaining} left
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </Page>
  )
}
