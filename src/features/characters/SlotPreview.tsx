import { computeSlots, type WizardCharacter } from '../../rules'

/** Compact table of spells per day: total, with base / bonus / specialist below. */
export function SlotPreview({ character }: { character: WizardCharacter }) {
  let slots
  try {
    slots = computeSlots(character)
  } catch {
    return null
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-center text-sm">
        <thead>
          <tr className="text-xs text-ink/60">
            <th className="py-1 text-left font-normal">Spell level</th>
            {slots.map((l) => (
              <th key={l.spellLevel} className="px-1 font-normal">
                {l.spellLevel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1 text-left text-xs text-ink/60">Per day</td>
            {slots.map((l) => (
              <td key={l.spellLevel} className={`px-1 font-display text-lg ${l.locked ? 'text-ink/30 line-through' : 'text-leather'}`}>
                {l.total}
              </td>
            ))}
          </tr>
          <tr className="text-[11px] text-ink/55">
            <td className="text-left">base+bonus+spec.</td>
            {slots.map((l) => (
              <td key={l.spellLevel} className="px-1 whitespace-nowrap">
                {l.base}
                {l.bonus ? `+${l.bonus}` : ''}
                {l.specialist ? `+${l.specialist}` : ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {slots.some((l) => l.locked) && (
        <p className="mt-1 text-xs text-rubric">Crossed-out levels need more Int (10 + spell level) to prepare.</p>
      )}
    </div>
  )
}
