import { describe, it, expect } from 'vitest'
import { PRIORITES_MESURE, prioriteRank, comparePriorite } from '@/lib/ecosystem-measures'

// Enrichissement des mesures écosystème — priorités P1→P4 (GitHub issue #2).

describe('priorités des mesures écosystème', () => {
  it('expose P1→P4 dans l’ordre', () => {
    expect(PRIORITES_MESURE).toEqual(['P1', 'P2', 'P3', 'P4'])
  })
  it('rang croissant P1 < P2 < P3 < P4', () => {
    expect(prioriteRank('P1')).toBeLessThan(prioriteRank('P2'))
    expect(prioriteRank('P3')).toBeLessThan(prioriteRank('P4'))
  })
  it('priorité absente/inconnue passe en dernier', () => {
    expect(prioriteRank(undefined)).toBeGreaterThan(prioriteRank('P4'))
    expect(prioriteRank('P9')).toBeGreaterThan(prioriteRank('P4'))
  })
  it('comparePriorite trie P1 d’abord, inconnus en fin', () => {
    const arr = [{ priorite: 'P3' }, { priorite: 'P1' }, { priorite: undefined }, { priorite: 'P2' }]
    const sorted = [...arr].sort(comparePriorite).map(m => m.priorite)
    expect(sorted).toEqual(['P1', 'P2', 'P3', undefined])
  })
})
