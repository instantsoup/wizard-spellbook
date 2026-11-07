import { resolveHouseRules } from './houseRules'
import { abilityModifier, MAX_WIZARD_LEVEL, MIN_WIZARD_LEVEL } from './tables'
import { check, SPECIALIZABLE_SCHOOLS, type RuleCheck, type School, type WizardCharacter } from './types'

/** Int used for casting and minimum-Int checks (all bonuses count). */
export function effectiveInt(c: WizardCharacter): number {
  return c.int.base + c.int.enhancement + c.int.inherent
}

/** Int used for bonus spells (enhancement may be excluded by house rule). */
export function bonusSpellInt(c: WizardCharacter): number {
  const rules = resolveHouseRules(c.houseRules)
  return c.int.base + c.int.inherent + (rules.enhancementCountsForBonus ? c.int.enhancement : 0)
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
  for (const [k, v] of Object.entries(c.int)) {
    if (!Number.isInteger(v)) errors.push(`Int ${k} must be a whole number.`)
  }
  if (c.int.base < 1) errors.push('Intelligence score must be at least 1.')
  if (effectiveInt(c) < 11) warnings.push('With Int below 11 a wizard cannot cast 1st-level spells.')
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
