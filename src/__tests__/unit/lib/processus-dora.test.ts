import { describe, it, expect } from 'vitest'
import {
  CRITICITES_DORA,
  cleanCriticiteDora,
  estFciCritiqueImportante,
  cleanDureeMinutes,
  formatDuree,
  resumeContinuite,
} from '@/lib/processus-dora'

describe('cleanCriticiteDora', () => {
  it('accepte les 3 classifications DORA', () => {
    expect(cleanCriticiteDora('CRITIQUE')).toBe('CRITIQUE')
    expect(cleanCriticiteDora('IMPORTANTE')).toBe('IMPORTANTE')
    expect(cleanCriticiteDora('NON_CRITIQUE')).toBe('NON_CRITIQUE')
  })
  it('renvoie null pour vide/inconnu', () => {
    expect(cleanCriticiteDora('')).toBeNull()
    expect(cleanCriticiteDora(null)).toBeNull()
    expect(cleanCriticiteDora('AUTRE')).toBeNull()
  })
  it('CRITICITES_DORA énumère les 3 valeurs', () => {
    expect(CRITICITES_DORA).toEqual(['CRITIQUE', 'IMPORTANTE', 'NON_CRITIQUE'])
  })
})

describe('estFciCritiqueImportante (fonction critique ou importante = FCI)', () => {
  it('vrai pour CRITIQUE et IMPORTANTE, faux sinon', () => {
    expect(estFciCritiqueImportante('CRITIQUE')).toBe(true)
    expect(estFciCritiqueImportante('IMPORTANTE')).toBe(true)
    expect(estFciCritiqueImportante('NON_CRITIQUE')).toBe(false)
    expect(estFciCritiqueImportante(null)).toBe(false)
  })
})

describe('cleanDureeMinutes (RTO/RPO en minutes)', () => {
  it('entier positif conservé', () => {
    expect(cleanDureeMinutes(240)).toBe(240)
    expect(cleanDureeMinutes('90')).toBe(90)
    expect(cleanDureeMinutes(0)).toBe(0)
  })
  it('null/négatif/non fini → null', () => {
    expect(cleanDureeMinutes(null)).toBeNull()
    expect(cleanDureeMinutes('')).toBeNull()
    expect(cleanDureeMinutes(-5)).toBeNull()
    expect(cleanDureeMinutes('abc')).toBeNull()
  })
  it('arrondi + borné à 1 an (525600 min)', () => {
    expect(cleanDureeMinutes(30.7)).toBe(31)
    expect(cleanDureeMinutes(9_999_999)).toBe(525600)
  })
})

describe('formatDuree', () => {
  const u = { j: 'j', h: 'h', min: 'min' }
  it('compose jours/heures/minutes', () => {
    expect(formatDuree(45, u)).toBe('45 min')
    expect(formatDuree(60, u)).toBe('1 h')
    expect(formatDuree(90, u)).toBe('1 h 30 min')
    expect(formatDuree(1440, u)).toBe('1 j')
    expect(formatDuree(1530, u)).toBe('1 j 1 h 30 min')
  })
  it('0 → « 0 min », null → tiret', () => {
    expect(formatDuree(0, u)).toBe('0 min')
    expect(formatDuree(null, u)).toBe('—')
  })
})

describe('resumeContinuite', () => {
  it('renvoie null si aucun objectif défini', () => {
    expect(resumeContinuite(null, null)).toBeNull()
  })
  it('assemble RTO/RPO présents', () => {
    const u = { j: 'j', h: 'h', min: 'min' }
    expect(resumeContinuite(240, 60, u)).toEqual({ rto: '4 h', rpo: '1 h' })
    expect(resumeContinuite(240, null, u)).toEqual({ rto: '4 h', rpo: null })
  })
})
