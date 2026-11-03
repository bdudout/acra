// Rétention du journal d'audit : bornes de la durée (refus hors bornes, jamais de correction silencieuse) et date limite.
import { describe, expect, it } from 'vitest'
import { lireRetention, dateLimiteRetention, RETENTION_MIN_MOIS, RETENTION_MAX_MOIS } from '@/lib/audit-retention'

describe('lireRetention', () => {
  it('vide / null = conservation illimitée', () => {
    expect(lireRetention(null)).toEqual({ ok: true, value: null })
    expect(lireRetention('')).toEqual({ ok: true, value: null })
  })
  it('entier dans les bornes', () => {
    expect(lireRetention(60)).toEqual({ ok: true, value: 60 })
    expect(lireRetention(RETENTION_MIN_MOIS - 1)).toEqual({ ok: false, error: 'retention_hors_bornes' })
    expect(lireRetention(RETENTION_MAX_MOIS + 1)).toEqual({ ok: false, error: 'retention_hors_bornes' })
    expect(lireRetention(12.5)).toEqual({ ok: false, error: 'retention_hors_bornes' })
    expect(lireRetention('60')).toEqual({ ok: false, error: 'retention_hors_bornes' })
  })
})
describe('dateLimiteRetention', () => {
  it('soustrait les mois en UTC', () => {
    expect(dateLimiteRetention(new Date('2026-11-03T10:00:00Z'), 12).toISOString()).toBe('2025-11-03T10:00:00.000Z')
    expect(dateLimiteRetention(new Date('2026-03-31T00:00:00Z'), 1).toISOString()).toBe('2026-03-03T00:00:00.000Z')
  })
})
