import { downloadBackup } from '../../data/backup'
import { db } from '../../data/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button, Card } from '../../components/ui'

const DAY = 24 * 60 * 60 * 1000
export const BACKUP_EVERY_DAYS = 14

/** Pure helper so the timing is testable. */
export function backupDue(now: number, lastBackupAt?: number, snoozedUntil?: number, hasData = true): boolean {
  if (!hasData) return false
  if (snoozedUntil && now < snoozedUntil) return false
  return !lastBackupAt || now - lastBackupAt > BACKUP_EVERY_DAYS * DAY
}

export function Reminders({ hasSpells }: { hasSpells: boolean }) {
  const [now] = useState(() => Date.now())
  const settings = useLiveQuery(async () => {
    const [hint, last, snooze] = await db.settings.bulkGet(['hintDismissed', 'lastBackupAt', 'backupSnoozedUntil'])
    return { hintDismissed: hint?.value as boolean | undefined, lastBackupAt: last?.value as number | undefined, snoozedUntil: snooze?.value as number | undefined }
  }, [])
  if (!settings) return null // still loading: show nothing rather than flash
  const { hintDismissed, lastBackupAt, snoozedUntil } = settings
  const due = backupDue(now, lastBackupAt, snoozedUntil, hasSpells)
  return (
    <>
      {!hintDismissed && hasSpells && (
        <Card className="mb-4 text-sm">
          <p className="mb-1 font-display text-base text-leather">How your spellbook works</p>
          <ol className="ml-5 list-decimal space-y-0.5 text-ink/80">
            <li>
              <b>Library</b>: add spells to your book (free level-up picks or paid).
            </li>
            <li>
              <b>Prepare</b>: after resting, fill your slots for the day.
            </li>
            <li>
              <b>Today</b>: tap a spell when you cast it. <b>Rest</b> starts a new day.
            </li>
          </ol>
          <Button variant="ghost" className="mt-1 -ml-4 text-sm" onClick={() => db.settings.put({ key: 'hintDismissed', value: true })}>
            Got it
          </Button>
        </Card>
      )}
      {due && (
        <Card className="mb-4 border-rubric/30 text-sm">
          <p>
            <span className="font-semibold text-rubric">Back up your spellbook.</span>{' '}
            {lastBackupAt ? `Last backup ${Math.floor((now - lastBackupAt) / DAY)} days ago.` : 'No backup yet.'} It only lives on this
            device.
          </p>
          <div className="mt-2 flex gap-2">
            <Button className="flex-1" onClick={() => downloadBackup()}>
              Save backup
            </Button>
            <Button variant="secondary" onClick={() => db.settings.put({ key: 'backupSnoozedUntil', value: Date.now() + 7 * DAY })}>
              Later
            </Button>
          </div>
        </Card>
      )}
    </>
  )
}
