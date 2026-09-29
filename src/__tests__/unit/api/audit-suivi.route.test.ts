/** POST /api/audit/constats/[id]/suivi : déclarer réalisé, vérifier, rouvrir, report d'échéance. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), find: vi.fn(), update: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditConstat: { findFirst: m.find, update: m.update } } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))

import { POST } from '@/app/api/audit/constats/[id]/suivi/route'

const params = { params: Promise.resolve({ id: 'c1' }) }
const req = (body: unknown) => new NextRequest('http://x/api/audit/constats/c1/suivi', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const constat = (o = {}) => ({ id: 'c1', organizationId: 'o1', statut: 'EN_COURS', echeance: new Date('2026-10-31T00:00:00Z'), echeanceInitiale: null, reports: [], realiseePar: null, ...o })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u2', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI', scope: { isSuperAdmin: false, visibleOrgIds: ['o1'] } })
  m.config.mockResolvedValue({ auditInterneActive: true })
  m.find.mockResolvedValue(constat())
  m.update.mockImplementation(async (a: { data: object }) => ({ ...constat(), ...a.data }))
})

describe('POST suivi', () => {
  it('401 sans session ; 404 hors périmètre ; 403 module inactif', async () => {
    m.session.mockResolvedValue(null)
    expect((await POST(req({ action: 'DECLARER_REALISE' }), params)).status).toBe(401)
    m.session.mockResolvedValue({ user: { id: 'u2', role: 'ANALYSTE' } })
    m.find.mockResolvedValue(null)
    expect((await POST(req({ action: 'DECLARER_REALISE' }), params)).status).toBe(404)
    m.find.mockResolvedValue(constat())
    m.config.mockResolvedValue({ auditInterneActive: false })
    expect((await POST(req({ action: 'DECLARER_REALISE' }), params)).status).toBe(403)
  })
  it('l’audité (RSSI) déclare la recommandation réalisée : statut RESOLU, réalisée par lui', async () => {
    const res = await POST(req({ action: 'DECLARER_REALISE' }), params)
    expect(res.status).toBe(200)
    expect(m.update.mock.calls[0][0].data).toMatchObject({ statut: 'RESOLU', realiseePar: 'u2' })
    expect(m.audit).toHaveBeenCalled()
  })
  it('le lecteur ne peut pas agir ; l’audité ne peut pas vérifier', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'LECTEUR', scope: { isSuperAdmin: false, visibleOrgIds: ['o1'] } })
    expect((await POST(req({ action: 'DECLARER_REALISE' }), params)).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI', scope: { isSuperAdmin: false, visibleOrgIds: ['o1'] } })
    m.find.mockResolvedValue(constat({ statut: 'RESOLU', realiseePar: 'u9' }))
    const res = await POST(req({ action: 'VERIFIER' }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('role_audit_requis')
  })
  it('l’auditeur vérifie (autre personne) puis rouvre avec motif', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'AUDITEUR', scope: { isSuperAdmin: false, visibleOrgIds: ['o1'] } })
    m.find.mockResolvedValue(constat({ statut: 'RESOLU', realiseePar: 'u9' }))
    expect((await POST(req({ action: 'VERIFIER', commentaire: 'Preuves contrôlées' }), params)).status).toBe(200)
    expect(m.update.mock.calls[0][0].data).toMatchObject({ statut: 'VERIFIE', verifiePar: 'u2' })
    m.find.mockResolvedValue(constat({ statut: 'VERIFIE' }))
    expect((await POST(req({ action: 'REOUVRIR' }), params)).status).toBe(400)
    expect((await POST(req({ action: 'REOUVRIR', commentaire: 'Preuve insuffisante' }), params)).status).toBe(200)
  })
  it('report d’échéance : demande par l’audité, décision par l’auditeur', async () => {
    expect((await POST(req({ action: 'DEMANDER_REPORT', nouvelleEcheance: '2026-12-31', motif: 'Dépendance projet' }), params)).status).toBe(200)
    const reports = m.update.mock.calls[0][0].data.reports
    expect(reports[0]).toMatchObject({ statut: 'DEMANDE', demandePar: 'u2' })
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'AUDITEUR', scope: { isSuperAdmin: false, visibleOrgIds: ['o1'] } })
    m.find.mockResolvedValue(constat({ reports }))
    expect((await POST(req({ action: 'DECIDER_REPORT', index: 0, decision: 'APPROUVE' }), params)).status).toBe(200)
    expect(m.update.mock.calls[1][0].data.echeance).toEqual(new Date('2026-12-31T00:00:00.000Z'))
  })
  it('action inconnue : 400', async () => {
    expect((await POST(req({ action: 'XXX' }), params)).status).toBe(400)
  })
})
