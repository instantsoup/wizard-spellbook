import { computeSlots, type WizardCharacter } from '../../rules'

/** Spells per day: one cell per spell level (total, with base+bonus+specialist), wrapping to fit. */
export function SlotPreview({ character }: { character: WizardCharacter }) {
  let slots
  try {
    slots = computeSlots(character)
  } catch {
    return null
  }
  return (
    <div>
      <ul className="grid grid-cols-5 gap-1.5">
        {slots.map((l) => (
          <li key={l.spellLevel} className="rounded-lg border border-ink/15 bg-surface/40 px-1 py-1 text-center">
            <div className="text-[11px] text-ink/60">{l.spellLevel === 0 ? 'Cantrip' : `Level ${l.spellLevel}`}</div>
            <div className={`font-display text-xl leading-tight ${l.locked ? 'text-ink/30 line-through' : 'text-leather'}`}>{l.total}</div>
            <div className="text-[11px] text-ink/55">
              {l.base}
              {l.bonus ? `+${l.bonus}` : ''}
              {l.specialist ? `+${l.specialist}` : ''}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-ink/55">Per day: base + Int bonus{character.specialty ? ' + specialist' : ''}.</p>
      {slots.some((l) => l.locked) && (
        <p className="mt-1 text-xs text-rubric">Crossed-out levels need more Int (10 + spell level) to prepare.</p>
      )}
    </div>
  )
}
