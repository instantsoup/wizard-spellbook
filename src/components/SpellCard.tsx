import { SchoolIcon } from './SchoolIcon'
import { useMemo, type ReactNode } from 'react'
import type { Spell } from '../data/spell-schema'
import { renderSpellText } from './markdown'
import { ordinal, SCHOOL_STYLE } from './schools'

export function schoolLine(s: Spell) {
  return [s.school, s.subschool && `(${s.subschool})`, s.descriptors.length ? `[${s.descriptors.join(', ')}]` : '']
    .filter(Boolean)
    .join(' ')
}

/** A spell row: tap to expand the full text. */
export function SpellRow({
  spell,
  open,
  onToggle,
  aside,
  muted,
  children,
}: {
  spell: Spell
  open: boolean
  onToggle: () => void
  /** Right-hand slot: checkbox, badge, button... */
  aside?: ReactNode
  muted?: boolean
  /** Extra content shown under the details when open. */
  children?: ReactNode
}) {
  const style = SCHOOL_STYLE[spell.school]
  return (
    <li className="border-b border-ink/10">
      <div className={`flex items-stretch gap-3 ${muted ? 'opacity-45' : ''}`}>
        <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: style.color }} aria-hidden />
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 py-2.5 text-left">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-semibold text-ink">{spell.name}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wide" style={{ color: style.color }}>
              <SchoolIcon school={spell.school} />
              {style.abbr}
            </span>
            <span className="shrink-0 text-xs text-ink/50">{spell.components.join(', ')}</span>
          </div>
          {spell.summary && <p className="truncate text-sm text-ink/70">{spell.summary}</p>}
        </button>
        {aside && <div className="flex shrink-0 items-center">{aside}</div>}
      </div>
      {open && (
        <div className="pb-4 pl-4">
          <SpellDetails spell={spell} />
          {children}
        </div>
      )}
    </li>
  )
}

export function SpellDetails({ spell }: { spell: Spell }) {
  const html = useMemo(() => renderSpellText(spell.description), [spell.description])
  const rows: [string, string | undefined][] = [
    ['Level', `Sor/Wiz ${spell.level}`],
    ['Components', spell.components.join(', ')],
    ['Casting Time', spell.castingTime],
    ['Range', spell.range],
    [spell.targetLabel ?? 'Target', spell.target],
    ['Area', spell.area],
    ['Effect', spell.effect],
    ['Duration', spell.duration],
    ['Saving Throw', spell.savingThrow],
    ['Spell Resistance', spell.spellResistance],
  ]
  return (
    <div className="text-sm">
      <p className="mb-2 italic" style={{ color: SCHOOL_STYLE[spell.school].color }}>
        {schoolLine(spell)} · {ordinal(spell.level)}-level
      </p>
      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-ink/80">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      <div className="spell-text" dangerouslySetInnerHTML={{ __html: html }} />
      {spell.materialComponent && <ComponentNote label="Material Component" text={spell.materialComponent} />}
      {spell.focus && <ComponentNote label="Focus" text={spell.focus} />}
      {spell.xpCost && <ComponentNote label="XP Cost" text={spell.xpCost} />}
      <p className="mt-2 text-xs text-ink/50">
        Source: {spell.source}
        {spell.page ? `, p. ${spell.page}` : ''}
      </p>
    </div>
  )
}

function ComponentNote({ label, text }: { label: string; text: string }) {
  const html = useMemo(() => renderSpellText(text), [text])
  return (
    <div className="spell-text mt-2">
      <span className="font-semibold italic">{label}: </span>
      <span dangerouslySetInnerHTML={{ __html: html.replace(/^<p>|<\/p>$/g, '') }} />
    </div>
  )
}
