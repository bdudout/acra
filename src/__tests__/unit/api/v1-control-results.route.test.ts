/** POST /api/v1/controls/[id]/results : résultat d'un contrôle automatique poussé par un SI tiers. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), tx: { controleExecution: { create: vi.fn() }, controle: { update: vi.fn() } }, config: vi.fn(), action: vi.fn(), audit: vi.fn(), rl: vi.fn() }))
vi.mock('@/lib/api-auth.server', () => ({ authenticateApiRequest: m.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: { controle: { findFirst: m.find }, $transaction: async (fn: (tx: unknown) => unknown) => fn(m.tx) } }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/plan-action.server', () => ({ createRiskLinkedPlanAction: m.action }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, LIMIT_API_WRITE: { limit: 30, windowMs: 60000 } }))

import { POST } from '@/app/api/v1/controls/[id]/results/route'

const params = { params: Promise.resolve({ id: 'c1' }) }
const req = (body: unknown) => new NextRequest('http://x/api/v1/controls/c1/results', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const controle = (o = {}) => ({ id: 'c1', organizationId: 'o1', intitule: 'Patchs critiques', actif: true, modeControle: 'AUTOMATIQUE', riskItemId: 'r1', responsable: 'RSSI', ...o })

beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ ok: true, organizationId: 'o1', scopes: ['write'], keyId: 'k1', actorUserId: 'u1' })
  m.find.mockResolvedValue(controle())
  m.config.mockResolvedValue({ controlePermanentActive: true, registreRisquesActive: true })
  m.tx.controleExecution.create.mockResolvedValue({ id: 'x1' })
  m.action.mockResolvedValue({ id: 'a1' })
  m.rl.mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 })
})

describe('POST /api/v1/controls/[id]/results', () => {
  it('clé invalide ou scope insuffisant : l’erreur d’authentification est renvoyée', async () => {
    m.auth.mockResolvedValue({ ok: false, status: 403, error: 'scope' })
    expect((await POST(req({ resultat: 'CONFORME' }), params)).status).toBe(403)
  })
  it('enregistre un résultat, source API, exécutant = la clé ; anomalie → action liée au risque', async () => {
    const res = await POST(req({ resultat: 'ANOMALIE', constat: '3 serveurs non patchés', tailleTestee: 40, anomaliesTrouvees: 3 }), params)
    expect(res.status).toBe(201)
    const data = m.tx.controleExecution.create.mock.calls[0][0].data
    expect(data).toMatchObject({ controleId: 'c1', organizationId: 'o1', resultat: 'ANOMALIE', source: 'API', executantId: 'api:k1' })
    expect(m.action).toHaveBeenCalled()
    expect((await res.json()).actionCreee).toBe('a1')
    expect(m.audit).toHaveBeenCalled()
  })
  it('un résultat conforme ne crée pas d’action', async () => {
    await POST(req({ resultat: 'CONFORME' }), params)
    expect(m.action).not.toHaveBeenCalled()
  })
  it('refuse : contrôle d’une autre organisation (404), manuel (400), inactif (400), module inactif (403), résultat invalide (400)', async () => {
    m.find.mockResolvedValue(null)
    expect((await POST(req({ resultat: 'CONFORME' }), params)).status).toBe(404)
    m.find.mockResolvedValue(controle({ modeControle: 'MANUEL' }))
    expect((await POST(req({ resultat: 'CONFORME' }), params)).status).toBe(400)
    m.find.mockResolvedValue(controle({ actif: false }))
    expect((await POST(req({ resultat: 'CONFORME' }), params)).status).toBe(400)
    m.find.mockResolvedValue(controle())
    m.config.mockResolvedValue({ controlePermanentActive: false })
    expect((await POST(req({ resultat: 'CONFORME' }), params)).status).toBe(403)
    m.config.mockResolvedValue({ controlePermanentActive: true })
    expect((await POST(req({ resultat: 'NOPE' }), params)).status).toBe(400)
  })
  it('limite de débit par clé (429)', async () => {
    m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 })
    expect((await POST(req({ resultat: 'CONFORME' }), params)).status).toBe(429)
  })
})
