import { describe, it, expect } from 'vitest'
import {
  calcDateFin, joursAvantExpiration, etatDerogation, needsExpiryAlert, buildDerogationDigest,
  validateDerogationInput, statutInitial, statutApresAvisRssi, statutApresDoubleRegard, estTerminale,
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
describe('buildDerogationDigest', () => {
  const derogs = [
    { id: 'a', statut: 'ACTIVE' as const, intitule: 'Loin', dateFin: inDays(200) },      // active
    { id: 'b', statut: 'ACTIVE' as const, intitule: 'Bientôt', dateFin: inDays(10) },     // expire bientôt (<=30)
    { id: 'c', statut: 'ACTIVE' as const, intitule: 'Expirée', dateFin: inDays(-5) },     // expirée
    { id: 'd', statut: 'CLOTUREE' as const, intitule: 'Clôturée', dateFin: inDays(-1) },  // ignorée (non ACTIVE)
    { id: 'e', statut: 'ACTIVE' as const, intitule: 'Sans fin', dateFin: null },          // active (jamais)
  ]
  it('compte par état dérivé et liste les à-risque, plus urgent d\'abord', () => {
    const d = buildDerogationDigest(derogs, 30, NOW)
    expect(d.active).toBe(2)        // a + e
    expect(d.expireBientot).toBe(1) // b
    expect(d.expiree).toBe(1)       // c
    expect(d.aRisque.map(x => x.id)).toEqual(['c', 'b']) // c (-5j) avant b (10j)
    expect(d.aRisque[0].etat).toBe('EXPIREE')
    expect(d.aRisque[1].etat).toBe('EXPIRE_BIENTOT')
  })
  it('périmètre vide → tout à zéro', () => {
    expect(buildDerogationDigest([], 30, NOW)).toEqual({ active: 0, expireBientot: 0, expiree: 0, aRisque: [] })
  })
})

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
  it('SOCLE (portée abstraite) est désormais invalide — toujours un contrôle ou un risque', () => {
    expect(validateDerogationInput({ portee: 'SOCLE', referentiel: 'ISO27001', intitule: 'X', motif: 'm', mesuresCompensatoires: 'c' })).toBe('portee_invalide')
  })
})

// ─── Machine à états ─────────────────────────────────────────────────────────
describe('transitions', () => {
  it('statut initial : AUTONOME → ACTIVE, sinon DEMANDEE', () => {
    expect(statutInitial('AUTONOME')).toBe('ACTIVE')
    expect(statutInitial('RSSI')).toBe('DEMANDEE')
    expect(statutInitial('RSSI_METIER')).toBe('DEMANDEE')
  })
  it('avis RSSI défavorable → REJETEE', () => {
    expect(statutApresAvisRssi(false, false, 'RSSI_METIER', true)).toBe('REJETEE')
  })
  it('avis RSSI favorable + double regard (autorisé) → DOUBLE_REGARD', () => {
    expect(statutApresAvisRssi(true, true, 'RSSI_METIER', true)).toBe('DOUBLE_REGARD')
  })
  it('double regard demandé mais désactivé en config → suit le niveau', () => {
    expect(statutApresAvisRssi(true, true, 'RSSI_METIER', false)).toBe('VALIDATION_METIER')
    expect(statutApresAvisRssi(true, true, 'RSSI', false)).toBe('ACTIVE')
  })
  it('avis RSSI favorable : niveau RSSI_METIER → VALIDATION_METIER, niveau RSSI → ACTIVE', () => {
    expect(statutApresAvisRssi(true, false, 'RSSI_METIER', true)).toBe('VALIDATION_METIER')
    expect(statutApresAvisRssi(true, false, 'RSSI', true)).toBe('ACTIVE')
  })
  it('double regard favorable suit le niveau ; défavorable → REJETEE', () => {
    expect(statutApresDoubleRegard(true, 'RSSI_METIER')).toBe('VALIDATION_METIER')
    expect(statutApresDoubleRegard(true, 'RSSI')).toBe('ACTIVE')
    expect(statutApresDoubleRegard(false, 'RSSI_METIER')).toBe('REJETEE')
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
  it('validation métier : le DEMANDEUR ne peut pas valider sa propre dérogation (quatre-yeux, #122)', () => {
    // Même quand le demandeur est DIRECTION_METIER (ou admin), l'auto-validation est refusée.
    expect(canValiderDerogation(u('DIRECTION_METIER', 'porteur'), { statut: 'VALIDATION_METIER', demandeurId: 'porteur' })).toBe(false)
    expect(canValiderDerogation(u('ADMIN', 'porteur'), { statut: 'VALIDATION_METIER', demandeurId: 'porteur' })).toBe(false)
    // Un AUTRE valideur métier reste autorisé.
    expect(canValiderDerogation(u('DIRECTION_METIER', 'autre'), { statut: 'VALIDATION_METIER', demandeurId: 'porteur' })).toBe(true)
  })
  it('mode ligne unique (2ᵉ ligne off) : le demandeur peut valider (quatre-yeux relâché)', () => {
    const self = { statut: 'VALIDATION_METIER' as const, demandeurId: 'porteur' }
    // 2ᵉ ligne active (défaut) : refus ; off : autorisé pour le même acteur (DIRECTION_METIER/admin).
    expect(canValiderDerogation(u('ADMIN', 'porteur'), self, { secondeLigneActive: false })).toBe(true)
    expect(canValiderDerogation(u('ADMIN', 'porteur'), self, { secondeLigneActive: true })).toBe(false)
    // Le rôle requis reste exigé même en mode ligne unique (LECTEUR ne valide pas).
    expect(canValiderDerogation(u('LECTEUR', 'porteur'), self, { secondeLigneActive: false })).toBe(false)
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
