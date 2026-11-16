import { describe, expect, it } from 'vitest'
import { feedbackUrl } from './feedback'

describe('feedbackUrl', () => {
  it('fills in the GitHub new-issue form', () => {
    const url = new URL(feedbackUrl('bug', ' Slots wrong ', 'Level 5 shows 2 slots', { Version: 'abc' }))
    expect(url.origin + url.pathname).toBe('https://github.com/instantsoup/wizard-spellbook/issues/new')
    expect(url.searchParams.get('title')).toBe('Bug: Slots wrong')
    expect(url.searchParams.get('body')).toBe('Level 5 shows 2 slots\n\n---\n- Version: abc')
    expect(url.searchParams.get('labels')).toBe('bug')
  })

  it('leaves out labels for spell reports and handles empty text', () => {
    const url = new URL(feedbackUrl('spell', '', '', {}))
    expect(url.searchParams.get('title')).toBe('Spell data: (no title)')
    expect(url.searchParams.has('labels')).toBe(false)
  })
})
