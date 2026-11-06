import { useEffect, type ReactNode } from 'react'

/** Bottom sheet dialog for phones (centered card on wide screens). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-parchment px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-2xl">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/20 sm:hidden" aria-hidden />
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl text-leather">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 size-11 text-2xl text-ink/60">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
