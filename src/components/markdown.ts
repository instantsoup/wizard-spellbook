// Tiny, safe renderer for spell descriptions. Supports what the spell data uses:
// paragraphs, "- " bullet lists, _italic_, **bold**, and simple HTML tables.
// Everything else is escaped, so imported spell files can't inject markup.

const ALLOWED_TAGS = new Set([
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'em', 'strong', 'i', 'b', 'sup', 'sub', 'br',
])

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Escapes text, keeping only allow-listed tags (with all attributes removed). */
export function sanitize(input: string): string {
  let out = ''
  let last = 0
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g
  for (let m = tagRe.exec(input); m; m = tagRe.exec(input)) {
    out += escapeHtml(input.slice(last, m.index))
    const name = m[1].toLowerCase()
    const closing = m[0].startsWith('</')
    // colspan/rowspan are kept (numeric only) so tables keep their shape
    const span = closing ? '' : [...m[0].matchAll(/\b(colspan|rowspan)="?(\d{1,2})"?/gi)].map((a) => ` ${a[1].toLowerCase()}="${a[2]}"`).join('')
    out += ALLOWED_TAGS.has(name) ? `<${closing ? '/' : ''}${name}${span}>` : escapeHtml(m[0])
    last = m.index + m[0].length
  }
  return out + escapeHtml(input.slice(last))
}

function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])_([^_]+?)_(?=[^\w]|$)/g, '$1<em>$2</em>')
}

export function renderSpellText(md: string): string {
  const blocks = md.replace(/\r\n/g, '\n').split(/\n\s*\n/)
  return blocks
    .map((block) => {
      const b = block.trim()
      if (!b) return ''
      const safe = sanitize(b)
      if (/^<table/i.test(b)) return inline(safe)
      const lines = safe.split('\n')
      if (lines.every((l) => /^\s*[-*] /.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`
      }
      return `<p>${inline(lines.join(' '))}</p>`
    })
    .join('')
}
