import type { School } from '../data/spell-schema'

export type { School }

/** The schools a wizard can specialize in or prohibit (everything but Universal). */
export const SPECIALIZABLE_SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
] as const satisfies readonly School[]

export interface IntScore {
  base: number
  /** e.g. Headband of Intellect +4 */
  enhancement: number
  /** e.g. Tome of Clear Thought */
  inherent: number
}

/** The parts of a character the rules engine needs. */
export interface WizardCharacter {
  wizardLevel: number
  int: IntScore
  /** Int modifier when the character was 1st level; fixes the starting free-spell count. */
  intModAtLevel1: number
  /** Int score at 1st level (for display; the modifier above is what the rules use). */
  intAtLevel1?: number
  /** undefined = generalist */
  specialty?: School
  prohibited: School[]
}

export type AcquisitionMethod =
  | 'starting-cantrip'
  | 'starting-free'
  | 'levelup-free'
  | 'scroll'
  | 'other-book'
  | 'research'
  | 'other'

export const FREE_METHODS: readonly AcquisitionMethod[] = ['starting-cantrip', 'starting-free', 'levelup-free']

/** A spell in the wizard's book (repertoire). */
export interface KnownSpell {
  spellId: string
  /** Sor/Wiz level when learned. */
  spellLevel: number
  method: AcquisitionMethod
  /** Which wizard level granted this free pick (1 for starting picks). */
  freePickLevel?: number
  costGp: number
  note?: string
}

export type SlotKind = 'base' | 'bonus' | 'specialist'

export interface PreparedSlot {
  slotLevel: number
  kind: SlotKind
  /** undefined = left open */
  spellId?: string
  expended: boolean
}

/** Result of a rules check: errors block the action, warnings only inform. */
export interface RuleCheck {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export const check = (errors: string[], warnings: string[] = []): RuleCheck => ({
  ok: errors.length === 0,
  errors,
  warnings,
})
