import { useMemo, useState } from 'react'
import { levelLabel, ordinal } from '../../components/schools'
import { Sheet } from '../../components/Sheet'
import { SpellRow } from '../../components/SpellCard'
import { Button, inputClass } from '../../components/ui'
import type { Spell } from '../../data/spell-schema'
import { candidatesForSlot, type PreparedSlot, type WizardCharacter } from '../../rules'

export function slotTitle(slot: Pick<PreparedSlot, 'slotLevel' | 'kind'>, specialty?: string) {
  const lvl = slot.slotLevel === 0 ? 'Cantrip' : `${ordinal(slot.slotLevel)}-level`
  if (slot.kind === 'specialist') return `${lvl} ${specialty} slot`
  if (slot.kind === 'bonus') return `${lvl} bonus slot`
  return `${lvl} slot`
}

export function SlotPickerSheet({
  character,
  slot,
  knownSpells,
  onPick,
  onClose,
}: {
  character: WizardCharacter
  slot: PreparedSlot
  knownSpells: Spell[]
  onPick: (spellId: string | undefined) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string>()
  const candidates = useMemo(() => candidatesForSlot(character, slot, knownSpells), [character, slot, knownSpells])
  const q = query.trim().toLowerCase()
  const shown = candidates.filter((s) => !q || s.name.toLowerCase().includes(q) || s.summary?.toLowerCase().includes(q))
  const levels = [...new Set(shown.map((s) => s.level))]

  return (
    <Sheet title={slotTitle(slot, character.specialty)} onClose={onClose}>
      {slot.kind === 'specialist' && (
        <p className="-mt-2 mb-3 text-sm text-ink/70">Only {character.specialty} spells can go in this slot.</p>
      )}
      {candidates.length > 8 && (
        <input className={`${inputClass} mb-2`} type="search" placeholder="Search your book" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      {levels.map((l) => (
        <section key={l} className="mb-3">
          <h3 className="border-b border-leather/30 font-display text-base text-leather">
            {levelLabel(l)}
            {l < slot.slotLevel && <span className="ml-2 font-body text-xs text-ink/50">(in a higher slot)</span>}
          </h3>
          <ul>
            {shown
              .filter((s) => s.level === l)
              .map((s) => {
                const current = slot.spellId === s.id
                return (
                  <SpellRow
                    key={s.id}
                    spell={s}
                    open={openId === s.id}
                    onToggle={() => setOpenId(openId === s.id ? undefined : s.id)}
                    aside={
                      <Button variant={current ? 'primary' : 'secondary'} className="px-3 text-sm" onClick={() => onPick(s.id)} aria-label={`Prepare ${s.name}`}>
                        {current ? '✓' : 'Prepare'}
                      </Button>
                    }
                  />
                )
              })}
          </ul>
        </section>
      ))}
      {candidates.length === 0 && (
        <p className="py-6 text-center text-ink/60">
          No spells in your book fit this slot.
          {slot.kind === 'specialist' ? ` Add ${character.specialty} spells from the Library.` : ''}
        </p>
      )}
      {slot.spellId && (
        <Button variant="ghost" className="mt-2 w-full text-rubric" onClick={() => onPick(undefined)}>
          Leave this slot empty
        </Button>
      )}
    </Sheet>
  )
}
