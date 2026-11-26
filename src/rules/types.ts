import type { School } from '../data/spell-schema'
import type { Alignment } from './alignment'

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

/** Spellcasting classes the app knows. Only wizard so far; others will come later. */
export type CasterClass = 'wizard'

/** The parts of a character the rules engine needs. */
export interface WizardCharacter {
  /** Defaults to wizard when missing (characters made before classes existed). */
  casterClass?: CasterClass
  /** Unset = no alignment checks. */
  alignment?: Alignment
  wizardLevel: number
  /** Levels in prestige classes that add +1 wizard spellcasting level (default 0). */
  extraCasterLevels?: number
  /**
   * Custom casting (e.g. Tainted Scholar), replacing Int. Unset = use Int.
   * - `score`: the score used for bonus spells per day and the minimum to cast (10 + spell level),
   *   as if it were your Int (Tainted Scholar: 10 + depravity).
   * - `dc`: the modifier added to spell DCs (Tainted Scholar: half corruption).
   */
  customCasting?: { score: number; dc: number }
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
  /** Copied from another of the wizard's own spellbooks (half cost, PH p. 179). */
  | 'copy'

export const FREE_METHODS: readonly AcquisitionMethod[] = ['starting-cantrip', 'starting-free', 'levelup-free']

/** A spell in the wizard's book (repertoire). */
export interface KnownSpell {
  spellId: string
  /** Sor/Wiz level when learned. */
  spellLevel: number
  method: AcquisitionMethod
  /** Which of the character's spellbooks this entry is written in. */
  bookId?: string
  /** Which caster level granted this free pick (1 for starting picks). */
  freePickLevel?: number
  /** Cost to scribe the spell into the book (100 gp x spell level). */
  costGp: number
  /** What the scroll it was copied from cost (scroll method only). Copying uses the scroll up. */
  scrollCostGp?: number
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
