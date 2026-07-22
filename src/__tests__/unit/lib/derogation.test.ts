import { describe, it, expect } from 'vitest'
import {
  calcDateFin, joursAvantExpiration, etatDerogation, needsExpiryAlert,
  validateDerogationInput, statutApresAvisRssi, statutApresDoubleRegard, estTerminale,
  prolongationEntry,
  canAvisRssiDerogation, canDoubleRegardDerogation, canValiderDerogation,
  canRevoquerDerogation, canCloturerDerogation,
  type DerogationStatut,
} from '@/lib/derogation'
import type { SessionUser } from '@/lib/permissions'

const u = (role: SessionUser['role'], id = 'u1'): SessionUser => ({ id, role })
const NOW = new Date('2026-07-22T12:00:00Z')
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000)

// ─── Dates & expiration ──────────────────────────────────────────────────────
describe('calcDateFin', () => {
  it('ajoute la durée en jours', () => {
    expect(calcDateFin(new Date('2026-01-01T00:00:00Z'), 180).toISOString()).toBe('2026-06-30T00:00:00.000Z')
  })
})

describe('joursAvantExpiration', () => {
  it('positif si dans le futur, négatif si dépassée, Infinity si pas de date', () => {
    expect(joursAvantExpiration(inDays(30), NOW)).toBe(30)
    expect(joursAvantExpiration(inDays(-3), NOW)).toBe(-3)
    expect(joursAvantExpiration(null, NOW)).toBe(Infinity)
  })
})

describe('etatDerogation', () => {
  it('ACTIVE hors fenêtre → ACTIVE', () => {
    expect(etatDerogation({ statut: 'ACTIVE', dateFin: inDays(90) }, 30, NOW)).toBe('ACTIVE')
  })
  it('ACTIVE dans la fenêtre d\'alerte → EXPIRE_BIENTOT', () => {
    expect(etatDerogation({ statut: 'ACTIVE', dateFin: inDays(20) }, 30, NOW)).toBe('EXPIRE_BIENTOT')
  })
  it('ACTIVE dépassée → EXPIREE', () => {
    expect(etatDerogation({ statut: 'ACTIVE', dateFin: inDays(-1) }, 30, NOW)).toBe('EXPIREE')
  })
  it('statut non-actif → renvoyé tel quel (pas d\'expiration)', () => {
    expect(etatDerogation({ statut: 'DEMANDEE', dateFin: inDays(-100) }, 30, NOW)).toBe('DEMANDEE')
    expect(etatDerogation({ statut: 'CLOTUREE' }, 30, NOW)).toBe('CLOTUREE')
  })
})

describe('needsExpiryAlert', () => {
  it('ACTIVE + dans la fenêtre + jamais alertée → true', () => {
    expect(needsExpiryAlert({ statut: 'ACTIVE', dateFin: inDays(10), alerteeLe: null }, 30, NOW)).toBe(true)
  })
  it('déjà alertée → false', () => {
    expect(needsExpiryAlert({ statut: 'ACTIVE', dateFin: inDays(10), alerteeLe: NOW }, 30, NOW)).toBe(false)
  })
  it('hors fenêtre → false', () => {
    expect(needsExpiryAlert({ statut: 'ACTIVE', dateFin: inDays(90), alerteeLe: null }, 30, NOW)).toBe(false)
  })
  it('non-active → false', () => {
    expect(needsExpiryAlert({ statut: 'DEMANDEE', dateFin: inDays(1), alerteeLe: null }, 30, NOW)).toBe(false)
  })
})

// ─── Validation d'entrée ─────────────────────────────────────────────────────
describe('validateDerogationInput', () => {
  const base = { portee: 'CONTROLE', referentiel: 'ISO27001', ref: 'A.5.1', intitule: 'X', motif: 'm', mesuresCompensatoires: 'c' }
  it('valide une dérogation contrôle complète → null', () => {
    expect(validateDerogationInput(base)).toBeNull()
  })
  it('champs texte requis', () => {
    expect(validateDerogationInput({ ...base, intitule: '  ' })).toBe('intitule_requis')
    expect(validateDerogationInput({ ...base, motif: '' })).toBe('motif_requis')
    expect(validateDerogationInput({ ...base, mesuresCompensatoires: '' })).toBe('mesures_requises')
  })
  it('portée invalide', () => {
    expect(validateDerogationInput({ ...base, portee: 'BIDON' })).toBe('portee_invalide')
  })
  it('CONTROLE incomplet (référentiel/ref manquants)', () => {
    expect(validateDerogationInput({ ...base, ref: '' })).toBe('controle_incomplet')
  })
  it('RISQUE sans risqueId', () => {
    expect(validateDerogationInput({ portee: 'RISQUE', intitule: 'X', motif: 'm', mesuresCompensatoires: 'c' })).toBe('risque_manquant')
    expect(validateDerogationInput({ portee: 'RISQUE', risqueId: 'r1', intitule: 'X', motif: 'm', mesuresCompensatoires: 'c' })).toBeNull()
  })
  it('SOCLE sans référentiel', () => {
    expect(validateDerogationInput({ portee: 'SOCLE', intitule: 'X', motif: 'm', mesuresCompensatoires: 'c' })).toBe('socle_incomplet')
  })
})

// ─── Machine à états ─────────────────────────────────────────────────────────
describe('transitions', () => {
  it('avis RSSI défavorable → REJETEE', () => {
    expect(statutApresAvisRssi(false, false)).toBe('REJETEE')
  })
  it('avis RSSI favorable + double regard → DOUBLE_REGARD', () => {
    expect(statutApresAvisRssi(true, true)).toBe('DOUBLE_REGARD')
  })
  it('avis RSSI favorable sans double regard → VALIDATION_METIER', () => {
    expect(statutApresAvisRssi(true, false)).toBe('VALIDATION_METIER')
  })
  it('double regard favorable → VALIDATION_METIER, défavorable → REJETEE', () => {
    expect(statutApresDoubleRegard(true)).toBe('VALIDATION_METIER')
    expect(statutApresDoubleRegard(false)).toBe('REJETEE')
  })
  it('estTerminale', () => {
    for (const s of ['REJETEE', 'CLOTUREE', 'REVOQUEE'] as DerogationStatut[]) expect(estTerminale(s)).toBe(true)
    for (const s of ['DEMANDEE', 'ACTIVE', 'VALIDATION_METIER'] as DerogationStatut[]) expect(estTerminale(s)).toBe(false)
  })
  it('prolongationEntry sérialise l\'historique', () => {
    const e = prolongationEntry(inDays(5), inDays(185), '  besoin de temps ', 'u9', NOW)
    expect(e.motif).toBe('besoin de temps')
    expect(e.par).toBe('u9')
    expect(e.nouvelleDateFin).toBe(inDays(185).toISOString())
  })
})

// ─── RBAC ────────────────────────────────────────────────────────────────────
describe('RBAC dérogations', () => {
  it('avis RSSI : un RSSI ≠ demandeur, depuis DEMANDEE', () => {
    expect(canAvisRssiDerogation(u('RSSI', 'rssi'), { statut: 'DEMANDEE', demandeurId: 'porteur' })).toBe(true)
    expect(canAvisRssiDerogation(u('RSSI', 'porteur'), { statut: 'DEMANDEE', demandeurId: 'porteur' })).toBe(false) // = demandeur (SoD)
    expect(canAvisRssiDerogation(u('ANALYSTE', 'x'), { statut: 'DEMANDEE', demandeurId: 'porteur' })).toBe(false)
    expect(canAvisRssiDerogation(u('RSSI', 'rssi'), { statut: 'ACTIVE', demandeurId: 'porteur' })).toBe(false) // mauvais statut
  })
  it('double regard : un RSSI ≠ premier RSSI et ≠ demandeur', () => {
    const d = { statut: 'DOUBLE_REGARD' as const, demandeurId: 'porteur', avisRssiPar: 'rssi1' }
    expect(canDoubleRegardDerogation(u('RSSI', 'rssi2'), d)).toBe(true)
    expect(canDoubleRegardDerogation(u('RSSI', 'rssi1'), d)).toBe(false) // = premier RSSI
    expect(canDoubleRegardDerogation(u('RSSI', 'porteur'), d)).toBe(false) // = demandeur
  })
  it('validation métier : DIRECTION_METIER ou admin, depuis VALIDATION_METIER', () => {
    const d = { statut: 'VALIDATION_METIER' as const, demandeurId: 'p' }
    expect(canValiderDerogation(u('DIRECTION_METIER'), d)).toBe(true)
    expect(canValiderDerogation(u('ADMIN'), d)).toBe(true)
    expect(canValiderDerogation(u('RSSI'), d)).toBe(false)
    expect(canValiderDerogation(u('DIRECTION_METIER'), { statut: 'DEMANDEE', demandeurId: 'p' })).toBe(false)
  })
  it('révocation : RSSI/métier/admin, depuis ACTIVE', () => {
    const d = { statut: 'ACTIVE' as const, demandeurId: 'p' }
    expect(canRevoquerDerogation(u('RSSI'), d)).toBe(true)
    expect(canRevoquerDerogation(u('DIRECTION_METIER'), d)).toBe(true)
    expect(canRevoquerDerogation(u('ANALYSTE'), d)).toBe(false)
    expect(canRevoquerDerogation(u('RSSI'), { statut: 'DEMANDEE', demandeurId: 'p' })).toBe(false)
  })
  it('clôture : porteur-éditeur, RSSI ou admin, depuis ACTIVE', () => {
    const d = { statut: 'ACTIVE' as const, demandeurId: 'p' }
    expect(canCloturerDerogation(u('ANALYSTE', 'p'), d, true)).toBe(true)   // porteur éditeur
    expect(canCloturerDerogation(u('ANALYSTE', 'p'), d, false)).toBe(false) // pas éditeur
    expect(canCloturerDerogation(u('RSSI'), d, false)).toBe(true)
  })
})
