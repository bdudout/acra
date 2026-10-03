import { describe, expect, it } from 'vitest'
import {
  PIECES_HOMOLOGATION, piecesInitiales, sanitizePieces, dossierComplet, calcDateFin, etatValidite,
  canPreparerHomologation, canDeciderHomologation, validerTransition, sanitizeReserves, DUREE_DEFAUT_MOIS, sanitizeDuree,
} from '@/lib/homologation'

const now = new Date('2026-10-03T10:00:00Z')
const complet = () => piecesInitiales().map(p => ({ ...p, fourni: true }))

describe('homologation — dossier', () => {
  it('pièces attendues, toutes à fournir au départ ; dossier complet seulement si tout est fourni', () => {
    expect(PIECES_HOMOLOGATION).toEqual(['ANALYSE_RISQUES', 'PLAN_TRAITEMENT', 'RISQUES_RESIDUELS', 'TEST_INTRUSION', 'PCA_PRA', 'ATTESTATIONS_PRESTATAIRES'])
    expect(piecesInitiales().every(p => !p.fourni)).toBe(true)
    expect(dossierComplet(piecesInitiales())).toBe(false)
    expect(dossierComplet(complet())).toBe(true)
  })
  it('assainit les pièces reçues (types connus, une par type, référence bornée)', () => {
    const p = sanitizePieces([{ type: 'TEST_INTRUSION', fourni: true, reference: 'x'.repeat(500) }, { type: 'INCONNU', fourni: true }, { type: 'TEST_INTRUSION', fourni: false }])
    expect(p).toHaveLength(PIECES_HOMOLOGATION.length)
    expect(p.find(x => x.type === 'TEST_INTRUSION')).toMatchObject({ fourni: true })
    expect(p.find(x => x.type === 'TEST_INTRUSION')!.reference!.length).toBeLessThanOrEqual(200)
  })
  it('réserves : texte obligatoire, échéance facultative valide, 20 au plus', () => {
    expect(sanitizeReserves([{ texte: ' Corriger les vulnérabilités élevées ', echeance: '2027-01-31' }, { texte: '' }, { texte: 'a', echeance: 'pas une date' }]))
      .toEqual([{ texte: 'Corriger les vulnérabilités élevées', echeance: '2027-01-31' }, { texte: 'a' }])
    expect(sanitizeReserves(Array.from({ length: 30 }, (_, i) => ({ texte: `r${i}` }))).length).toBe(20)
  })
  it('durée : 36 mois par défaut, bornée de 1 à 60', () => {
    expect(DUREE_DEFAUT_MOIS).toBe(36); expect(sanitizeDuree(undefined)).toBe(36); expect(sanitizeDuree(0)).toBe(1); expect(sanitizeDuree(99)).toBe(60); expect(sanitizeDuree('24')).toBe(24)
  })
})

describe('homologation — validité', () => {
  it('date de fin = décision + durée', () => {
    expect(calcDateFin(new Date('2026-01-15T00:00:00Z'), 36).toISOString().slice(0, 10)).toBe('2029-01-15')
  })
  it('état : non décidée, valide, à renouveler (< 6 mois), expirée, refusée', () => {
    expect(etatValidite({ statut: 'PREPARATION', dateFin: null }, now)).toBe('NON_DECIDEE')
    expect(etatValidite({ statut: 'HOMOLOGUE', dateFin: new Date('2028-01-01') }, now)).toBe('VALIDE')
    expect(etatValidite({ statut: 'HOMOLOGUE_RESERVES', dateFin: new Date('2027-02-01') }, now)).toBe('A_RENOUVELER')
    expect(etatValidite({ statut: 'HOMOLOGUE', dateFin: new Date('2026-09-01') }, now)).toBe('EXPIREE')
    expect(etatValidite({ statut: 'REFUSE', dateFin: null }, now)).toBe('REFUSEE')
  })
})

describe('homologation — droits et transitions', () => {
  const h = { statut: 'COMMISSION' as const, preparePar: 'u-prep', autoriteId: 'u-auto', pieces: complet() }
  it('préparer : RSSI, gestionnaire des risques, administrateur', () => {
    for (const r of ['RSSI', 'RISK_MANAGER', 'ADMIN', 'SUPER_ADMIN']) expect(canPreparerHomologation(r as never)).toBe(true)
    for (const r of ['ANALYSTE', 'LECTEUR', 'DIRECTION_METIER', 'METIER']) expect(canPreparerHomologation(r as never)).toBe(false)
  })
  it('décider : autorité désignée ou direction métier / administrateur, jamais le préparateur', () => {
    expect(canDeciderHomologation({ id: 'u-auto', role: 'ANALYSTE' }, h)).toBe(true)
    expect(canDeciderHomologation({ id: 'u-dir', role: 'DIRECTION_METIER' }, h)).toBe(true)
    expect(canDeciderHomologation({ id: 'u-x', role: 'RSSI' }, h)).toBe(false)
    expect(canDeciderHomologation({ id: 'u-prep', role: 'ADMIN' }, h)).toBe(false)
  })
  it('transitions : préparation → commission → décision ; renvoi en préparation ; réexamen après décision', () => {
    expect(validerTransition({ ...h, statut: 'PREPARATION' }, 'COMMISSION', { id: 'u-prep', role: 'RSSI' })).toEqual({ ok: true })
    expect(validerTransition(h, 'HOMOLOGUE', { id: 'u-auto', role: 'ANALYSTE' })).toEqual({ ok: true })
    expect(validerTransition(h, 'PREPARATION', { id: 'u-auto', role: 'ANALYSTE' })).toEqual({ ok: true })
    expect(validerTransition({ ...h, statut: 'HOMOLOGUE' }, 'PREPARATION', { id: 'u-prep', role: 'RSSI' })).toEqual({ ok: true })
    expect(validerTransition({ ...h, statut: 'PREPARATION' }, 'HOMOLOGUE', { id: 'u-auto', role: 'ANALYSTE' })).toEqual({ ok: false, code: 'transition_interdite' })
  })
  it('refus motivés : dossier incomplet, réserves absentes, séparation, rôle', () => {
    expect(validerTransition({ ...h, pieces: piecesInitiales() }, 'HOMOLOGUE', { id: 'u-auto', role: 'ANALYSTE' })).toEqual({ ok: false, code: 'dossier_incomplet' })
    expect(validerTransition({ ...h, pieces: piecesInitiales() }, 'REFUSE', { id: 'u-auto', role: 'ANALYSTE' })).toEqual({ ok: true })
    expect(validerTransition(h, 'HOMOLOGUE_RESERVES', { id: 'u-auto', role: 'ANALYSTE' }, [])).toEqual({ ok: false, code: 'reserves_requises' })
    expect(validerTransition(h, 'HOMOLOGUE_RESERVES', { id: 'u-auto', role: 'ANALYSTE' }, [{ texte: 'r' }])).toEqual({ ok: true })
    expect(validerTransition(h, 'HOMOLOGUE', { id: 'u-prep', role: 'ADMIN' })).toEqual({ ok: false, code: 'separation' })
    expect(validerTransition({ ...h, statut: 'PREPARATION' }, 'COMMISSION', { id: 'u-z', role: 'ANALYSTE' })).toEqual({ ok: false, code: 'role_interdit' })
  })
})

describe('homologation — relance de renouvellement', () => {
  it('une alerte à l’entrée en « à renouveler », une autre à l’expiration, jamais pour une homologation valide ou non décidée', async () => {
    const { relanceHomologation } = await import('@/lib/homologation')
    const fin = new Date('2027-02-01T00:00:00Z')
    expect(relanceHomologation({ statut: 'HOMOLOGUE', dateFin: new Date('2028-06-01'), rappelLe: null }, now)).toBeNull()
    expect(relanceHomologation({ statut: 'PREPARATION', dateFin: null, rappelLe: null }, now)).toBeNull()
    expect(relanceHomologation({ statut: 'HOMOLOGUE', dateFin: fin, rappelLe: null }, now)).toBe('ECHEANCE_PROCHE')
    expect(relanceHomologation({ statut: 'HOMOLOGUE', dateFin: fin, rappelLe: new Date('2026-09-01') }, now)).toBeNull()
    const apres = new Date('2027-02-10T00:00:00Z')
    expect(relanceHomologation({ statut: 'HOMOLOGUE_RESERVES', dateFin: fin, rappelLe: new Date('2026-09-01') }, apres)).toBe('EN_RETARD')
    expect(relanceHomologation({ statut: 'HOMOLOGUE_RESERVES', dateFin: fin, rappelLe: new Date('2027-02-05') }, apres)).toBeNull()
  })
})
