// Daily preparation: which spells may go in which slot, and day bookkeeping.

import type { Spell } from '../data/spell-schema'
import { isProhibited } from './character'
import { computeSlots, listSlots } from './slots'
import { check, type PreparedSlot, type RuleCheck, type WizardCharacter } from './types'

/** A fresh, empty set of slots for the day. */
export function emptyDay(c: WizardCharacter): PreparedSlot[] {
  return listSlots(c).map((s) => ({ ...s, expended: false }))
}

/** Can this spell go in this slot? */
export function canFillSlot(
  c: WizardCharacter,
  slot: Pick<PreparedSlot, 'slotLevel' | 'kind'>,
  spell: Spell,
  knownSpellIds: ReadonlySet<string>,
): RuleCheck {
  const errors: string[] = []
  if (!knownSpellIds.has(spell.id)) errors.push(`${spell.name} is not in your book.`)
  if (isProhibited(c, spell.school)) errors.push(`${spell.school} is a prohibited school.`)
  if (spell.level > slot.slotLevel) {
    errors.push(`${spell.name} is level ${spell.level} and won't fit a level ${slot.slotLevel} slot.`)
  }
  if (slot.kind === 'specialist' && spell.school !== c.specialty) {
    errors.push(`Specialist slots only hold ${c.specialty ?? 'specialty'} spells.`)
  }
  const level = computeSlots(c).find((l) => l.spellLevel === slot.slotLevel)
  if (!level) errors.push(`You have no level ${slot.slotLevel} slots.`)
  else if (level.locked) errors.push(`Your Int is too low for level ${slot.slotLevel} spells.`)
  return check(errors)
}

/** Known spells that may legally fill a slot, sorted by level (highest first) then name. */
export function candidatesForSlot(
  c: WizardCharacter,
  slot: Pick<PreparedSlot, 'slotLevel' | 'kind'>,
  knownSpells: Spell[],
): Spell[] {
  const ids = new Set(knownSpells.map((s) => s.id))
  return knownSpells
    .filter((s) => canFillSlot(c, slot, s, ids).ok)
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name))
}

/** Checks every filled slot, and that the slot layout still matches the character. */
export function validateDay(
  c: WizardCharacter,
  slots: PreparedSlot[],
  spellsById: ReadonlyMap<string, Spell>,
  knownSpellIds: ReadonlySet<string>,
): RuleCheck {
  const errors: string[] = []
  const warnings: string[] = []
  const expected = listSlots(c)
  const key = (s: { slotLevel: number; kind: string }) => `${s.slotLevel}:${s.kind}`
  const count = (list: { slotLevel: number; kind: string }[]) =>
    list.reduce((m, s) => m.set(key(s), (m.get(key(s)) ?? 0) + 1), new Map<string, number>())
  const want = count(expected)
  const have = count(slots)
  for (const k of new Set([...want.keys(), ...have.keys()])) {
    if ((want.get(k) ?? 0) !== (have.get(k) ?? 0)) {
      warnings.push('Your slots changed (level or Int). Re-prepare to update them.')
      break
    }
  }
  slots.forEach((slot) => {
    if (!slot.spellId) return
    const spell = spellsById.get(slot.spellId)
    if (!spell) {
      errors.push(`Unknown spell "${slot.spellId}".`)
      return
    }
    errors.push(...canFillSlot(c, slot, spell, knownSpellIds).errors)
  })
  return check([...new Set(errors)], warnings)
}

/**
 * New slot layout for the character, keeping existing picks where a slot of the
 * same level and kind still exists. Used after a level-up or Int change, and to
 * carry yesterday's picks into a new day (with expended reset).
 */
export function reconcileDay(c: WizardCharacter, previous: PreparedSlot[], resetExpended = true): PreparedSlot[] {
  const pool = previous.map((s) => ({ ...s }))
  return emptyDay(c).map((slot) => {
    const i = pool.findIndex((p) => p.slotLevel === slot.slotLevel && p.kind === slot.kind)
    if (i < 0) return slot
    const [prev] = pool.splice(i, 1)
    return { ...slot, spellId: prev.spellId, expended: resetExpended ? false : prev.expended }
  })
}

export interface LevelUsage {
  spellLevel: number
  total: number
  prepared: number
  open: number
  expended: number
  remaining: number
}

/** Per-level counts for the Prepare and Today screens. */
export function dayUsage(slots: PreparedSlot[]): LevelUsage[] {
  const levels = [...new Set(slots.map((s) => s.slotLevel))].sort((a, b) => a - b)
  return levels.map((spellLevel) => {
    const here = slots.filter((s) => s.slotLevel === spellLevel)
    const prepared = here.filter((s) => s.spellId).length
    const expended = here.filter((s) => s.spellId && s.expended).length
    return {
      spellLevel,
      total: here.length,
      prepared,
      open: here.length - prepared,
      expended,
      remaining: prepared - expended,
    }
  })
}

/** Mark a slot cast (or un-cast). Returns a new array. */
export function setExpended(slots: PreparedSlot[], index: number, expended: boolean): PreparedSlot[] {
  return slots.map((s, i) => (i === index && s.spellId ? { ...s, expended } : s))
}

export interface CastGroup {
  slotLevel: number
  spellId: string
  /** Indexes into the day's slots, in order. */
  slotIndexes: number[]
  expended: number
  remaining: number
}

/** Prepared spells grouped by slot level and spell, for the Today screen. */
export function castGroups(slots: PreparedSlot[]): CastGroup[] {
  const groups = new Map<string, CastGroup>()
  slots.forEach((s, i) => {
    if (!s.spellId) return
    const key = `${s.slotLevel}:${s.spellId}`
    let g = groups.get(key)
    if (!g) {
      g = { slotLevel: s.slotLevel, spellId: s.spellId, slotIndexes: [], expended: 0, remaining: 0 }
      groups.set(key, g)
    }
    g.slotIndexes.push(i)
    if (s.expended) g.expended++
    else g.remaining++
  })
  return [...groups.values()]
}

/** Casts one copy of a prepared spell (first unexpended slot). Returns the slot index used, or -1. */
export function castOne(slots: PreparedSlot[], group: Pick<CastGroup, 'slotIndexes'>): { slots: PreparedSlot[]; index: number } {
  const index = group.slotIndexes.find((i) => slots[i] && !slots[i].expended) ?? -1
  return { slots: index < 0 ? slots : setExpended(slots, index, true), index }
}

/** Un-casts one copy (last expended slot). */
export function restoreOne(slots: PreparedSlot[], group: Pick<CastGroup, 'slotIndexes'>): { slots: PreparedSlot[]; index: number } {
  const index = [...group.slotIndexes].reverse().find((i) => slots[i]?.expended) ?? -1
  return { slots: index < 0 ? slots : setExpended(slots, index, false), index }
}

/**
 * Fills a day from saved picks (a template). Each pick goes to the first open slot of the
 * same level and kind; picks that no longer fit (slot gone, spell not legal) are skipped.
 */
export function applyPicks(
  c: WizardCharacter,
  slots: PreparedSlot[],
  picks: Pick<PreparedSlot, 'slotLevel' | 'kind' | 'spellId'>[],
  spellsById: ReadonlyMap<string, Spell>,
  knownSpellIds: ReadonlySet<string>,
): { slots: PreparedSlot[]; skipped: number } {
  const next: PreparedSlot[] = slots.map((s) => ({ ...s, spellId: undefined, expended: false }))
  let skipped = 0
  for (const p of picks) {
    const spell = p.spellId ? spellsById.get(p.spellId) : undefined
    if (!spell) {
      if (p.spellId) skipped++
      continue
    }
    const i = next.findIndex(
      (s) => !s.spellId && s.slotLevel === p.slotLevel && s.kind === p.kind && canFillSlot(c, s, spell, knownSpellIds).ok,
    )
    if (i < 0) skipped++
    else next[i].spellId = spell.id
  }
  return { slots: next, skipped }
}
