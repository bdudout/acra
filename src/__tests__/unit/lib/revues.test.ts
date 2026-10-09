// Revues périodiques (systèmes d'IA, traitements RGPD, processus, tiers) : prochaine revue 12 mois après la dernière,
// ou après la création si l'objet n'a jamais été revu ; relance quand l'échéance approche puis au dépassement.
import { describe, expect, it } from 'vitest'
import { echeanceRevue, MOIS_REVUE, sanitizeDateRevue } from '@/lib/revues'

describe('echeanceRevue', () => {
  it('12 mois après la dernière revue', () => {
    expect(MOIS_REVUE).toBe(12)
    expect(echeanceRevue(new Date('2025-10-15T00:00:00Z'), new Date('2020-01-01T00:00:00Z')).toISOString().slice(0, 10)).toBe('2026-10-15')
  })
  it('jamais revu : 12 mois après la création', () => {
    expect(echeanceRevue(null, new Date('2026-01-31T00:00:00Z')).toISOString().slice(0, 10)).toBe('2027-01-31')
  })
})

describe('sanitizeDateRevue', () => {
  it('date AAAA-MM-JJ valide, pas dans le futur ; vide → null ; invalide → undefined (champ ignoré)', () => {
    const now = new Date('2026-10-09T12:00:00Z')
    expect(sanitizeDateRevue('2026-10-01', now)?.toISOString().slice(0, 10)).toBe('2026-10-01')
    expect(sanitizeDateRevue('', now)).toBeNull()
    expect(sanitizeDateRevue(null, now)).toBeNull()
    expect(sanitizeDateRevue('pas une date', now)).toBeUndefined()
    expect(sanitizeDateRevue('2027-01-01', now)).toBeUndefined()
    expect(sanitizeDateRevue(undefined, now)).toBeUndefined()
  })
})
