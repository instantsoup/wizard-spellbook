import { describe, expect, it } from 'vitest'
import { renderSpellText, sanitize } from './markdown'

describe('renderSpellText', () => {
  it('renders paragraphs, italics and bold', () => {
    expect(renderSpellText('A _fireball_ is **hot**.\n\nSecond.')).toBe(
      '<p>A <em>fireball</em> is <strong>hot</strong>.</p><p>Second.</p>',
    )
  })
  it('leaves underscores inside words alone', () => {
    expect(renderSpellText('snake_case_name')).toBe('<p>snake_case_name</p>')
  })
  it('renders bullet lists', () => {
    expect(renderSpellText('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
  })
  it('keeps tables but strips attributes', () => {
    expect(renderSpellText('<table class="x" onclick="evil()"><tr><td colspan="2">a</td></tr></table>')).toBe(
      '<table><tr><td colspan="2">a</td></tr></table>',
    )
  })
})

describe('sanitize', () => {
  it('escapes scripts and unknown tags', () => {
    expect(sanitize('<script>alert(1)</script><img src=x onerror=y>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=y&gt;',
    )
  })
  it('escapes stray angle brackets and ampersands', () => {
    expect(sanitize('HD < 5 & more')).toBe('HD &lt; 5 &amp; more')
  })
})
