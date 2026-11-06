import type { AcquisitionMethod } from '../rules'

export const METHOD_LABEL: Record<AcquisitionMethod, string> = {
  'starting-cantrip': 'Starting cantrip',
  'starting-free': 'Starting spell',
  'levelup-free': 'Level-up pick',
  scroll: 'From a scroll',
  'other-book': "From another wizard's book",
  research: 'Researched',
  other: 'Other',
}

export const gp = (n: number) => `${n.toLocaleString()} gp`
