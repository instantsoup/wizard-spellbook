// Prepared days and saved loadouts (templates).

import { emptyDay, reconcileDay, type PreparedSlot, type WizardCharacter } from '../rules'
import { db, newId, type CharacterRecord, type PreparedDayRecord, type PrepTemplateRecord, type SpellbookDB } from './db'

/** How many past days to keep per character. */
export const DAY_HISTORY = 30

export async function getCurrentDay(characterId: string, d: SpellbookDB = db): Promise<PreparedDayRecord | undefined> {
  return d.days.where('[characterId+current]').equals([characterId, 1]).first()
}

/** The current day, creating an empty one if the character has none yet. */
export async function ensureCurrentDay(character: CharacterRecord, d: SpellbookDB = db): Promise<PreparedDayRecord> {
  return d.transaction('rw', d.days, async () => {
    const existing = await getCurrentDay(character.id, d)
    if (existing) return existing
    const day: PreparedDayRecord = { id: newId(), characterId: character.id, startedAt: Date.now(), current: 1, slots: emptyDay(character) }
    await d.days.add(day)
    return day
  })
}

/**
 * Rest & prepare: closes the current day and starts a new one.
 * With `keepSpells`, yesterday's picks carry over (cast marks cleared);
 * otherwise every slot starts empty. Slots always match the character's current layout.
 */
export async function startNewDay(
  character: WizardCharacter & { id: string },
  opts: { keepSpells: boolean; label?: string },
  d: SpellbookDB = db,
): Promise<PreparedDayRecord> {
  return d.transaction('rw', d.days, async () => {
    const prev = await getCurrentDay(character.id, d)
    if (prev) await d.days.update(prev.id, { current: 0 })
    const slots = prev && opts.keepSpells ? reconcileDay(character, prev.slots) : emptyDay(character)
    const day: PreparedDayRecord = {
      id: newId(),
      characterId: character.id,
      startedAt: Date.now(),
      current: 1,
      slots,
      ...(opts.label?.trim() ? { label: opts.label.trim() } : {}),
    }
    await d.days.add(day)
    // Trim old history.
    const all = await d.days.where('characterId').equals(character.id).sortBy('startedAt')
    const excess = all.length - DAY_HISTORY
    if (excess > 0) await d.days.bulkDelete(all.slice(0, excess).map((x) => x.id))
    return day
  })
}

export async function saveDaySlots(dayId: string, slots: PreparedSlot[], d: SpellbookDB = db) {
  await d.days.update(dayId, { slots })
}

export async function saveTemplate(characterId: string, name: string, slots: PreparedSlot[], d: SpellbookDB = db) {
  const picks = slots.filter((s) => s.spellId).map(({ slotLevel, kind, spellId }) => ({ slotLevel, kind, spellId }))
  const existing = await d.templates.where('characterId').equals(characterId).filter((t) => t.name === name).first()
  const record: PrepTemplateRecord = { id: existing?.id ?? newId(), characterId, name, picks }
  await d.templates.put(record)
  return record
}

export async function deleteTemplate(id: string, d: SpellbookDB = db) {
  await d.templates.delete(id)
}
