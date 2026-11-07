import { describe, expect, it } from 'vitest'
import { backupDue } from './Reminders'

const DAY = 86_400_000
describe('backupDue', () => {
  const now = 100 * DAY
  it('is due with data and no backup', () => expect(backupDue(now)).toBe(true))
  it('is not due without data', () => expect(backupDue(now, undefined, undefined, false)).toBe(false))
  it('is due after 14 days', () => {
    expect(backupDue(now, now - 13 * DAY)).toBe(false)
    expect(backupDue(now, now - 15 * DAY)).toBe(true)
  })
  it('respects snooze', () => expect(backupDue(now, undefined, now + DAY)).toBe(false))
})
