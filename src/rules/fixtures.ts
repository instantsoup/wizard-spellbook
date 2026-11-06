// Sample characters and spells shared by the rules tests.
import type { Spell } from '../data/spell-schema'
import type { WizardCharacter } from './types'

export const generalist1: WizardCharacter = {
  wizardLevel: 1,
  int: { base: 16, enhancement: 0, inherent: 0 },
  intModAtLevel1: 3,
  prohibited: [],
}

export const evoker5: WizardCharacter = {
  wizardLevel: 5,
  int: { base: 18, enhancement: 0, inherent: 0 },
  intModAtLevel1: 4,
  specialty: 'Evocation',
  prohibited: ['Enchantment', 'Illusion'],
}

export const diviner9: WizardCharacter = {
  wizardLevel: 9,
  int: { base: 20, enhancement: 4, inherent: 0 },
  intModAtLevel1: 4,
  specialty: 'Divination',
  prohibited: ['Necromancy'],
}

export const generalist20: WizardCharacter = {
  wizardLevel: 20,
  int: { base: 30, enhancement: 0, inherent: 4 },
  intModAtLevel1: 4,
  prohibited: [],
}

const spell = (id: string, name: string, school: Spell['school'], level: number): Spell => ({
  id,
  name,
  school,
  level,
  descriptors: [],
  components: ['V', 'S'],
  description: '-',
  source: 'test',
})

export const S = {
  detectMagic: spell('detect-magic', 'Detect Magic', 'Divination', 0),
  daze: spell('daze', 'Daze', 'Enchantment', 0),
  rayOfFrost: spell('ray-of-frost', 'Ray of Frost', 'Evocation', 0),
  magicMissile: spell('magic-missile', 'Magic Missile', 'Evocation', 1),
  sleep: spell('sleep', 'Sleep', 'Enchantment', 1),
  mageArmor: spell('mage-armor', 'Mage Armor', 'Conjuration', 1),
  identify: spell('identify', 'Identify', 'Divination', 1),
  scorchingRay: spell('scorching-ray', 'Scorching Ray', 'Evocation', 2),
  invisibility: spell('invisibility', 'Invisibility', 'Illusion', 2),
  fireball: spell('fireball', 'Fireball', 'Evocation', 3),
  haste: spell('haste', 'Haste', 'Transmutation', 3),
  wallOfFire: spell('wall-of-fire', 'Wall of Fire', 'Evocation', 4),
  coneOfCold: spell('cone-of-cold', 'Cone of Cold', 'Evocation', 5),
  wish: spell('wish', 'Wish', 'Universal', 9),
}
