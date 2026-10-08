// @vitest-environment node
// PATCH /api/ropa/[id]/aipd : suivi de l'AIPD d'un traitement — DPO / ADMIN ; traitement et analyse de l'organisation
// active ; « non retenue » refusée sans justification dès qu'un critère WP248 est présent ; journalisé.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), audit: vi.fn(), find: vi.fn(), update: vi.fn(), analyse: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/prisma', () => ({ prisma: { traitement: { findFirst: m.find, update: m.update }, analyse: { findFirst: m.analyse } } }))
import { PATCH } from '@/app/api/ropa/[id]/aipd/route'

const patch = (body: object) => PATCH(new NextRequest('http://x/api/ropa/t1/aipd', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 't1' }) })
const T = { id: 't1', organizationId: 'o1', nom: 'Scoring', finalite: 'F', baseLegale: 'contrat', categoriesPersonnes: ['Clients'], categoriesDonnees: ['Achats'], destinataires: ['X'], transfertHorsUE: false, dureeConservation: '1 an', mesuresSecurite: ['M'], grandeEchelle: true, surveillanceSystematique: false, criteresAipd: ['EVALUATION'] }

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'DPO' })
  m.find.mockResolvedValue(T)
  m.analyse.mockResolvedValue({ id: 'a1' })
  m.update.mockImplementation(async ({ data }: { data: object }) => ({ ...T, ...data }))
})

describe('PATCH /api/ropa/[id]/aipd', () => {
  it('enregistre le suivi (statut, analyse de l’organisation, date) ; journalisé', async () => {
    const r = await patch({ aipdStatut: 'EN_COURS', aipdAnalyseId: 'a1', aipdDate: '2026-10-01' })
    expect(r.status).toBe(200)
    expect(m.find.mock.calls[0][0].where).toEqual({ id: 't1', organizationId: 'o1' })
    expect(m.analyse.mock.calls[0][0].where).toEqual({ id: 'a1', organizationId: 'o1', deletedAt: null })
    expect(m.update.mock.calls[0][0].data).toMatchObject({ aipdStatut: 'EN_COURS', aipdAnalyseId: 'a1', aipdDate: new Date('2026-10-01') })
    expect(m.audit).toHaveBeenCalledWith('ORGANIZATION_CONFIG_UPDATED', expect.objectContaining({ details: expect.objectContaining({ scope: 'ropa', action: 'aipd', statut: 'EN_COURS' }) }))
  })
  it('AIPD requise « non retenue » sans justification → 400 ; avec justification → 200', async () => {
    const r = await patch({ aipdStatut: 'NON_RETENUE' })
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('justification_requise')
    expect((await patch({ aipdStatut: 'NON_RETENUE', aipdJustification: 'Données pseudonymisées, risque faible' })).status).toBe(200)
  })
  it('analyse d’une autre organisation → 400 ; traitement d’une autre organisation → 404 ; autre rôle → 403', async () => {
    m.analyse.mockResolvedValue(null)
    expect((await patch({ aipdStatut: 'EN_COURS', aipdAnalyseId: 'autre' })).status).toBe(400)
    m.find.mockResolvedValue(null)
    expect((await patch({ aipdStatut: 'EN_COURS' })).status).toBe(404)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await patch({ aipdStatut: 'EN_COURS' })).status).toBe(403)
  })
})
