/**
 * Dérogation en revue : le demandeur peut MODIFIER sa demande tant que le RSSI
 * n'a rendu aucun avis, et la RETIRER à toute étape de revue (statut RETIREE,
 * jamais de suppression) ; le RSSI peut rendre un avis « favorable avec réserves »
 * (réserves obligatoires, tracées).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ userId: 'dem', role: 'ANALYSTE' }))
const db = vi.hoisted(() => ({ derogation: { findUnique: vi.fn(), update: vi.fn() } }))
const auditLog = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: state.userId, role: state.role } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(),
  getAccessibleOrgIds: vi.fn(async () => ({ all: false, ids: ['org1'] })),
  // Rôle effectif d'organisation : absent → rôle de session (comportement historique de ces cas).
  getEffectiveRoleForOrg: vi.fn(async () => null),
}))
vi.mock('@/lib/org-config.server', () => ({
  getOrgConfig: vi.fn(async () => ({ derogationWorkflow: 'RSSI_METIER', derogationDoubleRegard: false, derogationDureeDefautJours: 180, derogationDureeMaxJours: 365, secondeLigneActive: true })),
}))
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: () => '' }))

import { PATCH } from '@/app/api/derogations/[id]/route'

const base = {
  id: 'd1', organizationId: 'org1', analyseId: null, statut: 'DEMANDEE', demandeurId: 'dem', avisRssiPar: null,
  portee: 'CONTROLE', referentiel: 'ISO27001', ref: '5.1', intitule: 'Ancien', motif: 'm', mesuresCompensatoires: 'mc',
  dateDebut: null, dateFin: null, prolongations: [],
}
const call = (body: unknown) => PATCH({ json: async () => body, headers: new Headers() } as never, { params: Promise.resolve({ id: 'd1' }) })

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(state, { userId: 'dem', role: 'ANALYSTE' })
  db.derogation.findUnique.mockResolvedValue({ ...base })
  db.derogation.update.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ ...base, ...a.data }))
})

describe('MODIFIER', () => {
  it('le demandeur modifie sa demande avant tout avis RSSI', async () => {
    const res = await call({ action: 'MODIFIER', intitule: 'Nouveau', motif: 'Motif revu', mesuresCompensatoires: 'MFA' })
    expect(res.status).toBe(200)
    expect(db.derogation.update.mock.calls[0][0].data).toEqual({ intitule: 'Nouveau', motif: 'Motif revu', mesuresCompensatoires: 'MFA' })
    expect(auditLog).toHaveBeenCalledWith('DEROGATION_UPDATED', expect.anything())
  })

  it('refusé après un avis RSSI, ou pour un autre utilisateur ; champs requis', async () => {
    db.derogation.findUnique.mockResolvedValueOnce({ ...base, avisRssiPar: 'rssi' })
    expect((await call({ action: 'MODIFIER', intitule: 'x', motif: 'x', mesuresCompensatoires: 'x' })).status).toBe(403)
    state.userId = 'autre'
    expect((await call({ action: 'MODIFIER', intitule: 'x', motif: 'x', mesuresCompensatoires: 'x' })).status).toBe(403)
    state.userId = 'dem'
    expect((await call({ action: 'MODIFIER', intitule: 'x', motif: '', mesuresCompensatoires: 'x' })).status).toBe(400)
    expect(db.derogation.update).not.toHaveBeenCalled()
  })
})

describe('RETIRER', () => {
  it('le demandeur retire sa demande en revue : RETIREE, pas de suppression', async () => {
    db.derogation.findUnique.mockResolvedValueOnce({ ...base, statut: 'VALIDATION_METIER', avisRssiPar: 'rssi' })
    const res = await call({ action: 'RETIRER', commentaire: 'Plus nécessaire' })
    expect(res.status).toBe(200)
    expect(db.derogation.update.mock.calls[0][0].data).toMatchObject({ statut: 'RETIREE', retraitMotif: 'Plus nécessaire' })
    expect(auditLog).toHaveBeenCalledWith('DEROGATION_WITHDRAWN', expect.anything())
  })

  it('refusé à un autre utilisateur et hors revue', async () => {
    state.userId = 'autre'
    expect((await call({ action: 'RETIRER' })).status).toBe(403)
    state.userId = 'dem'
    db.derogation.findUnique.mockResolvedValueOnce({ ...base, statut: 'ACTIVE' })
    expect((await call({ action: 'RETIRER' })).status).toBe(403)
  })
})

describe('AVIS_RSSI favorable avec réserves', () => {
  beforeEach(() => { Object.assign(state, { userId: 'rssi', role: 'RSSI' }) })

  it('réserves tracées, circuit identique à un avis favorable', async () => {
    const res = await call({ action: 'AVIS_RSSI', favorable: true, reserves: 'Revue mensuelle des accès' })
    expect(res.status).toBe(200)
    expect(db.derogation.update.mock.calls[0][0].data).toMatchObject({ statut: 'VALIDATION_METIER', avisRssiFavorable: true, avisRssiReserves: 'Revue mensuelle des accès' })
  })

  it('réserves vides → 400 ; réserves avec un avis défavorable → 400', async () => {
    expect((await call({ action: 'AVIS_RSSI', favorable: true, reserves: '  ' })).status).toBe(400)
    expect((await call({ action: 'AVIS_RSSI', favorable: false, reserves: 'x', commentaire: 'non' })).status).toBe(400)
    expect(db.derogation.update).not.toHaveBeenCalled()
  })

  it('avis favorable simple : aucune réserve enregistrée', async () => {
    await call({ action: 'AVIS_RSSI', favorable: true })
    expect(db.derogation.update.mock.calls[0][0].data.avisRssiReserves).toBeNull()
  })
})
