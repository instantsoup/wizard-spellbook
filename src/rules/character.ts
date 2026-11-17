import { abilityModifier, MAX_WIZARD_LEVEL, MIN_WIZARD_LEVEL, minIntForSpellLevel } from './tables'
import { check, SPECIALIZABLE_SCHOOLS, type RuleCheck, type School, type WizardCharacter } from './types'

/** Int used for bonus spells, casting and minimum-Int checks (score + item + inherent bonuses). */
export function effectiveInt(c: WizardCharacter): number {
  return c.int.base + c.int.enhancement + c.int.inherent
}

/** Caster level for spells per day: wizard levels plus prestige class levels that add spellcasting (max 20). */
export function casterLevel(c: WizardCharacter): number {
  return Math.min(MAX_WIZARD_LEVEL, c.wizardLevel + (c.extraCasterLevels ?? 0))
}

export const hasCustomCasting = (c: WizardCharacter): boolean => c.customCasting !== undefined

/** Modifier for bonus spells per day: the custom one if set, otherwise Int's. */
export function bonusSpellModifier(c: WizardCharacter): number {
  return c.customCasting?.bonusSpells ?? abilityModifier(effectiveInt(c))
}

/** Modifier added to spell DCs: the custom one if set, otherwise Int's. */
export function dcModifier(c: WizardCharacter): number {
  return c.customCasting?.dc ?? abilityModifier(effectiveInt(c))
}

/** Is the casting ability high enough for spells of this level? Always true with a custom modifier. */
export function meetsCastingMinimum(c: WizardCharacter, spellLevel: number): boolean {
  return hasCustomCasting(c) || effectiveInt(c) >= minIntForSpellLevel(spellLevel)
}

/** Save DC for a spell of this level: 10 + spell level + DC modifier. */
export function spellDc(c: WizardCharacter, spellLevel: number): number {
  return 10 + spellLevel + dcModifier(c)
}

export function isProhibited(c: WizardCharacter, school: School): boolean {
  return c.prohibited.includes(school)
}

/** How many prohibited schools a specialty requires (PHB: two; Divination: one). */
export function requiredProhibitedCount(specialty: School | undefined): number {
  if (!specialty) return 0
  return specialty === 'Divination' ? 1 : 2
}

/** Validates level, Int and the specialist/prohibited school choice. */
export function validateCharacter(c: WizardCharacter): RuleCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (!Number.isInteger(c.wizardLevel) || c.wizardLevel < MIN_WIZARD_LEVEL || c.wizardLevel > MAX_WIZARD_LEVEL) {
    errors.push('Wizard level must be between 1 and 20.')
  }
  const extra = c.extraCasterLevels ?? 0
  if (!Number.isInteger(extra) || extra < 0) errors.push('Prestige class caster levels must be 0 or more.')
  else if (c.wizardLevel + extra > MAX_WIZARD_LEVEL) warnings.push('Caster level is capped at 20 for spells per day.')
  if (c.customCasting && ![c.customCasting.bonusSpells, c.customCasting.dc].every(Number.isInteger)) {
    errors.push('Casting modifiers must be whole numbers.')
  }
  for (const [k, v] of Object.entries(c.int)) {
    if (!Number.isInteger(v)) errors.push(`Int ${k} must be a whole number.`)
  }
  if (c.int.base < 1) errors.push('Intelligence score must be at least 1.')
  if (!meetsCastingMinimum(c, 1)) warnings.push('With Int below 11 a wizard cannot cast 1st-level spells.')
  if (abilityModifier(c.int.base) !== c.intModAtLevel1 && c.wizardLevel === 1) {
    warnings.push('Starting Int modifier does not match base Int.')
  }

  const { specialty, prohibited } = c
  if (new Set(prohibited).size !== prohibited.length) errors.push('A school is prohibited twice.')
  if (specialty) {
    if (!(SPECIALIZABLE_SCHOOLS as readonly School[]).includes(specialty)) {
      errors.push(`${specialty} cannot be a specialty school.`)
    }
    if (prohibited.includes(specialty)) errors.push('You cannot prohibit your own specialty school.')
    const need = requiredProhibitedCount(specialty)
    if (prohibited.length !== need) {
      errors.push(
        specialty === 'Divination'
          ? 'A Divination specialist gives up exactly one other school.'
          : `A specialist gives up exactly two other schools (${prohibited.length} chosen).`,
      )
    }
  } else if (prohibited.length > 0) {
    errors.push('A generalist wizard has no prohibited schools.')
  }
  if (prohibited.includes('Divination')) errors.push('Divination cannot be a prohibited school.')
  if (prohibited.includes('Universal')) errors.push('Universal cannot be a prohibited school.')

  return check(errors, warnings)
}
