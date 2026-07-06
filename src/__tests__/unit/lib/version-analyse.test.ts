import { describe, it, expect } from 'vitest'
// Import relatif volontaire : sous Node 26 l'alias @/ casse vitest sur l'hôte.
import {
  CYCLES_REVISION,
  formatVersion,
  normalizeCycle,
  nextVersion,
} from '../../../lib/version-analyse'

describe('version-analyse (§3.4 — gestion des versions x.y)', () => {
  it('expose les 2 cycles de révision', () => {
    expect(CYCLES_REVISION).toEqual(['OPERATIONNEL', 'STRATEGIQUE'])
  })

  describe('formatVersion', () => {
    it('formate en x.y', () => {
      expect(formatVersion(1, 0)).toBe('1.0')
      expect(formatVersion(2, 3)).toBe('2.3')
    })
    it('borne les valeurs négatives/invalides à 0', () => {
      expect(formatVersion(-1, -5)).toBe('0.0')
      expect(formatVersion(NaN as unknown as number, 2)).toBe('0.2')
    })
  })

  describe('normalizeCycle', () => {
    it('laisse passer un cycle connu et normalise la casse', () => {
      expect(normalizeCycle('STRATEGIQUE')).toBe('STRATEGIQUE')
      expect(normalizeCycle('operationnel')).toBe('OPERATIONNEL')
    })
    it('retombe sur OPERATIONNEL pour une valeur inconnue', () => {
      expect(normalizeCycle('')).toBe('OPERATIONNEL')
      expect(normalizeCycle(null)).toBe('OPERATIONNEL')
      expect(normalizeCycle('autre')).toBe('OPERATIONNEL')
    })
  })

  describe('nextVersion', () => {
    it('incrémente le y (mineur) pour un cycle opérationnel', () => {
      expect(nextVersion(1, 0, 'OPERATIONNEL')).toEqual({ maj: 1, min: 1 })
      expect(nextVersion(2, 4, 'OPERATIONNEL')).toEqual({ maj: 2, min: 5 })
    })
    it('incrémente le x (majeur) et remet y à 0 pour un cycle stratégique', () => {
      expect(nextVersion(1, 3, 'STRATEGIQUE')).toEqual({ maj: 2, min: 0 })
      expect(nextVersion(2, 0, 'STRATEGIQUE')).toEqual({ maj: 3, min: 0 })
    })
    it('normalise un cycle inconnu vers opérationnel', () => {
      expect(nextVersion(1, 0, 'bidon' as never)).toEqual({ maj: 1, min: 1 })
    })
    it('assainit des valeurs de version invalides avant incrément', () => {
      expect(nextVersion(NaN as unknown as number, NaN as unknown as number, 'OPERATIONNEL')).toEqual({ maj: 0, min: 1 })
    })
  })
})
