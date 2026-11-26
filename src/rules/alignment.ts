// Alignment and the spells it affects.
// - Sanctified spells (Book of Exalted Deeds): "Evil characters cannot cast sanctified spells."
// - Casting a spell with an alignment descriptor is an act of that alignment (BoVD, BoED), so a
//   wizard opposed to it gets a note; nothing stops a wizard casting it. Corrupt spells are evil.
// (Clerics can't cast spells opposed to their own or their deity's alignment; that comes with
// cleric mode.)

import type { Spell } from '../data/spell-schema'
import type { WizardCharacter } from './types'

export const ALIGNMENTS = ['LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE'] as const
export type Alignment = (typeof ALIGNMENTS)[number]

export const ALIGNMENT_NAMES: Record<Alignment, string> = {
  LG: 'Lawful good',
  NG: 'Neutral good',
  CG: 'Chaotic good',
  LN: 'Lawful neutral',
  N: 'True neutral',
  CN: 'Chaotic neutral',
  LE: 'Lawful evil',
  NE: 'Neutral evil',
  CE: 'Chaotic evil',
}

type Axis = 'Good' | 'Evil' | 'Lawful' | 'Chaotic'
const OPPOSITE: Record<Axis, Axis> = { Good: 'Evil', Evil: 'Good', Lawful: 'Chaotic', Chaotic: 'Lawful' }

function axes(a: Alignment): Axis[] {
  const out: Axis[] = []
  if (a[0] === 'L') out.push('Lawful')
  if (a[0] === 'C') out.push('Chaotic')
  if (a.endsWith('G')) out.push('Good')
  if (a.endsWith('E')) out.push('Evil')
  return out
}

export const isEvil = (c: Pick<WizardCharacter, 'alignment'>) => !!c.alignment && axes(c.alignment).includes('Evil')

/** Why this character can't cast the spell at all, or undefined if it can. */
export function alignmentBar(c: Pick<WizardCharacter, 'alignment'>, spell: Pick<Spell, 'special'>): string | undefined {
  if (spell.special === 'Sanctified' && isEvil(c)) return "Evil characters can't cast sanctified spells."
  return undefined
}

/** Notes for spells whose alignment the character is opposed to (casting one is an act of that alignment). */
export function alignmentNotes(c: Pick<WizardCharacter, 'alignment'>, spell: Pick<Spell, 'descriptors' | 'special'>): string[] {
  if (!c.alignment) return []
  const own = axes(c.alignment)
  const spellAxes = new Set<Axis>(spell.descriptors.filter((d): d is Axis => d in OPPOSITE))
  if (spell.special === 'Corrupt') spellAxes.add('Evil')
  return [...spellAxes]
    .filter((a) => own.includes(OPPOSITE[a]))
    .map((a) => `Casting a${a === 'Evil' ? 'n' : ''} ${a.toLowerCase()} spell is ${a === 'Evil' ? 'an' : 'a'} ${a.toLowerCase()} act.`)
}
