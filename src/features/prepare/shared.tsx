import { useEffect, useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Button, Field, inputClass } from '../../components/ui'
import { ensureCurrentDay, startNewDay } from '../../data/days'
import type { CharacterRecord, PreparedDayRecord } from '../../data/db'
import { useCurrentDay } from '../../data/hooks'

/** The character's current day; creates an empty one the first time. */
export function useDay(character: CharacterRecord): PreparedDayRecord | undefined {
  const day = useCurrentDay(character.id)
  useEffect(() => {
    if (day === null) void ensureCurrentDay(character)
  }, [day, character])
  return day ?? undefined
}

export function dayTitle(day: PreparedDayRecord) {
  const date = new Date(day.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return day.label ? `${day.label} · ${date}` : `Prepared ${date}`
}

export function RestSheet({ character, onClose }: { character: CharacterRecord; onClose: () => void }) {
  const [keepSpells, setKeepSpells] = useState(true)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title="Rest & prepare" onClose={onClose}>
      <p className="mb-4 text-sm text-ink/70">
        After 8 hours of rest and an hour of study, all your slots refresh and you choose a new set of spells.
      </p>
      <label className="mb-4 flex min-h-11 items-center gap-3 rounded-lg border border-ink/20 px-3">
        <input type="checkbox" className="size-5 accent-[var(--color-leather)]" checked={keepSpells} onChange={(e) => setKeepSpells(e.target.checked)} />
        <span>Keep today's spells as a starting point</span>
      </label>
      <Field label="Name this day (optional)">
        <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Day 14, into the barrow" />
      </Field>
      <Button
        className="mt-4 w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await startNewDay(character, { keepSpells, label })
          onClose()
        }}
      >
        Rest & prepare
      </Button>
    </Sheet>
  )
}

/** Keeps the screen on while mounted (where supported). */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    const state: { lock?: WakeLockSentinel; cancelled: boolean } = { cancelled: false }
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return
        const lock = await navigator.wakeLock.request('screen')
        if (state.cancelled) void lock.release()
        else state.lock = lock
      } catch {
        /* denied or unsupported: ignore */
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && void acquire()
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      state.cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void state.lock?.release()
    }
  }, [enabled])
}
