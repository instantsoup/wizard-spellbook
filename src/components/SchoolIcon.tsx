import type { School } from '../data/spell-schema'

const PATHS: Record<School, string[]> = {
  // shield
  Abjuration: ['M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z'],
  // portal spiral
  Conjuration: ['M12 3a9 9 0 1 0 9 9', 'M12 7a5 5 0 1 0 5 5', 'M12 11a1 1 0 1 0 1 1'],
  // eye
  Divination: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  // heart
  Enchantment: ['M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z'],
  // lightning bolt
  Evocation: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  // crescent
  Illusion: ['M15 3a9 9 0 1 0 6 15 7 7 0 0 1-6-15z'],
  // skull
  Necromancy: ['M12 3a7 7 0 0 0-7 7c0 2.5 1.3 4 3 5v3h8v-3c1.7-1 3-2.5 3-5a7 7 0 0 0-7-7z', 'M9.5 10.5h.01M14.5 10.5h.01', 'M10 18v3M14 18v3'],
  // cycle arrows
  Transmutation: ['M4 12a8 8 0 0 1 14-5.3', 'M20 12a8 8 0 0 1-14 5.3', 'M18 3v4h-4', 'M6 21v-4h4'],
  // sparkle
  Universal: ['M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z'],
}

export function SchoolIcon({ school, className = 'size-3.5' }: { school: School; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[school].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
