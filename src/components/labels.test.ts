import { describe, expect, it } from 'vitest'
import { sourceAbbr } from './labels'

describe('sourceAbbr', () => {
  it('uses common abbreviations for known books', () => {
    expect(sourceAbbr('Spell Compendium')).toBe('SpC')
    expect(sourceAbbr('Book of Vile Darkness')).toBe('BoVD')
    expect(sourceAbbr("Player's Handbook II")).toBe('PH2')
    expect(sourceAbbr('SRD')).toBe('SRD')
  })
  it('makes one up for other sources', () => {
    expect(sourceAbbr('Homebrew')).toBe('Hom')
    expect(sourceAbbr('Kan Derra')).toBe('KD')
    expect(sourceAbbr('Tome of Secrets')).toBe('TS')
    expect(sourceAbbr('Dragon Magazine 326')).toBe('DM326')
    expect(sourceAbbr('KD')).toBe('KD')
    expect(sourceAbbr('')).toBe('?')
  })
})
