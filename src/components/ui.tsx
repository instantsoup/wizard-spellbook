import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-xl pb-28">
      <header className="sticky top-0 z-10 border-b border-ink/15 bg-parchment/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl text-leather">{title}</h1>
            {subtitle && <div className="text-sm text-ink/70">{subtitle}</div>}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
      </header>
      <main className="px-4 pt-4">{children}</main>
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-leather text-parchment shadow-sm active:bg-ink disabled:bg-ink/30',
  secondary: 'border border-leather/40 bg-parchment-dark/60 text-leather active:bg-parchment-dark disabled:opacity-40',
  danger: 'bg-rubric text-parchment active:bg-ink disabled:opacity-40',
  ghost: 'text-leather underline-offset-2 active:underline disabled:opacity-40',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`min-h-11 rounded-lg px-4 font-display text-base tracking-wide transition-colors ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-ink/15 bg-white/40 p-4 shadow-sm ${className}`}>{children}</section>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-6 font-display text-lg text-leather first:mt-0">{children}</h2>
}

/** A labelled control. Use `group` when the child has several controls (e.g. a Stepper). */
export function Field({ label, hint, group, children }: { label: string; hint?: ReactNode; group?: boolean; children: ReactNode }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="block">
      <span className="mb-1 block text-sm font-semibold text-ink/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/60">{hint}</span>}
    </Tag>
  )
}

export const inputClass =
  'min-h-11 w-full rounded-lg border border-ink/25 bg-white/70 px-3 text-base text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather/20'

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  label: string
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v))
  // While typing, keep the raw text; commit when it's a number in range.
  const [draft, setDraft] = useState<string>()
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        className="size-11 rounded-lg border border-ink/25 bg-white/60 text-xl text-leather disabled:opacity-30"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <input
        aria-label={`${label} value`}
        inputMode="numeric"
        className={`${inputClass} w-16 text-center`}
        value={draft ?? value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const text = e.target.value.replace(/[^0-9]/g, '')
          setDraft(text)
          const n = parseInt(text, 10)
          if (!Number.isNaN(n) && n >= min && n <= max) onChange(n)
        }}
        onBlur={() => setDraft(undefined)}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        className="size-11 rounded-lg border border-ink/25 bg-white/60 text-xl text-leather disabled:opacity-30"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </div>
  )
}

export function Chip({
  selected,
  disabled,
  onClick,
  color,
  children,
}: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  color?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      style={selected && color ? { backgroundColor: color, borderColor: color } : color ? { borderColor: color, color } : undefined}
      className={`min-h-9 rounded-full border px-3 text-sm transition-colors disabled:opacity-35 ${
        selected ? 'border-leather bg-leather text-parchment' : 'border-ink/30 bg-white/50 text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function Messages({ errors = [], warnings = [] }: { errors?: string[]; warnings?: string[] }) {
  if (!errors.length && !warnings.length) return null
  return (
    <div className="space-y-1 text-sm" role="status">
      {errors.map((e) => (
        <p key={e} className="rounded-md bg-rubric/10 px-3 py-2 text-rubric">
          {e}
        </p>
      ))}
      {warnings.map((w) => (
        <p key={w} className="rounded-md bg-amber-100/70 px-3 py-2 text-amber-900">
          {w}
        </p>
      ))}
    </div>
  )
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return <p className="p-8 text-center font-display text-ink/60">{what}…</p>
}
