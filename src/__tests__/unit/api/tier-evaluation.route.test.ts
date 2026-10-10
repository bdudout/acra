// @vitest-environment node
// Évaluation d'un usage de service tiers (lot T1) : usage de l'organisation active seulement (404 sinon), évaluation par
// le propriétaire du risque / l'analyste, validation par le RSSI ; traitements et risques rattachés filtrés à l'organisation.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  session: vi.fn(), scope: vi.fn(), rl: vi.fn(), audit: vi.fn(), orgCfg: vi.fn(),
  usage: vi.fn(), evalFind: vi.fn(), evalUpsert: vi.fn(), evalUpdate: vi.fn(), traitements: vi.fn(), risques: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_API_WRITE: { limit: 60, windowMs: 60_000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.orgCfg }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  tierServiceUsage: { findUnique: m.usage },
  evaluationUsageTiers: { findUnique: m.evalFind, upsert: m.evalUpsert, update: m.evalUpdate },
  traitement: { findMany: m.traitements }, riskItem: { findMany: m.risques },
} }))
import { GET, PUT, POST } from '@/app/api/tier-registry/usages/[usageId]/evaluation/route'

const p = { params: Promise.resolve({ usageId: 'u1' }) }
const req = (method: string, body?: object) => new NextRequest('http://x/api', { method, ...(body ? { body: JSON.stringify(body) } : {}) })
const scope = (role: string, org = 'org1') => ({ role, activeOrgId: org, scope: { visibleOrgIds: [org], isSuperAdmin: false } })
const COMPLETE = { dependance: 4, penetration: 3, maturite: 2, confiance: 2 }

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'user1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue(scope('ANALYSTE'))
  m.rl.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 })
  m.orgCfg.mockResolvedValue({ echellesEcosysteme: null, petiteStructure: false })
  m.usage.mockResolvedValue({ id: 'u1', organizationId: 'org1' })
  m.evalFind.mockResolvedValue(null)
  m.evalUpsert.mockImplementation(async (a: { create: object }) => ({ id: 'e1', statut: 'BROUILLON', ...a.create }))
  m.evalUpdate.mockImplementation(async (a: { data: object }) => ({ id: 'e1', ...a.data }))
  m.traitements.mockResolvedValue([{ id: 't1', nom: 'Paie' }])
  m.risques.mockResolvedValue([{ id: 'r1', intitule: 'Risque d’externalisation — hébergement', taxonomieCode: null }])
})

describe('évaluation d’un usage de service tiers', () => {
  it('usage d’une autre organisation : 404 (lecture comme écriture)', async () => {
    m.usage.mockResolvedValue({ id: 'u1', organizationId: 'autre' })
    expect((await GET(req('GET'), p)).status).toBe(404)
    expect((await PUT(req('PUT', { actuelle: COMPLETE }), p)).status).toBe(404)
    expect(m.evalUpsert).not.toHaveBeenCalled()
  })
  it('GET : cotation, droits et listes de rattachement (traitements, risques) de l’organisation', async () => {
    m.evalFind.mockResolvedValue({ id: 'e1', statut: 'SOUMISE', actuelle: COMPLETE, cible: null, clauses: [], traitementIds: [], risqueIds: [], justification: '', valideLe: null })
    const j = await (await GET(req('GET'), p)).json()
    expect(j.cotation.actuelle).toMatchObject({ menace: 3, zone: 'danger' })
    expect(j.droits).toEqual({ peutEvaluer: true, peutValider: false })
    expect(j.options.risques[0].id).toBe('r1')
    expect(m.risques.mock.calls[0][0].where).toMatchObject({ organizationId: 'org1' })
  })
  it('PUT : enregistre un brouillon ; identifiants rattachés hors organisation écartés ; rôle sans évaluation → 403', async () => {
    m.traitements.mockResolvedValue([{ id: 't1' }]); m.risques.mockResolvedValue([{ id: 'r1' }])
    const res = await PUT(req('PUT', { actuelle: COMPLETE, traitementIds: ['t1', 'tAutre'], risqueIds: ['r1', 'rAutre'], clauses: ['securite'] }), p)
    expect(res.status).toBe(200)
    const data = m.evalUpsert.mock.calls[0][0].create
    expect(data).toMatchObject({ usageId: 'u1', organizationId: 'org1', statut: 'BROUILLON', traitementIds: ['t1'], risqueIds: ['r1'], clauses: ['securite'], evaluePar: 'user1' })
    m.scope.mockResolvedValue(scope('LECTEUR'))
    expect((await PUT(req('PUT', { actuelle: COMPLETE }), p)).status).toBe(403)
  })
  it('POST : l’analyste soumet ; seul le RSSI valide (date de validation → réévaluation dans 12 mois)', async () => {
    m.evalFind.mockResolvedValue({ id: 'e1', statut: 'BROUILLON', actuelle: COMPLETE, cible: null })
    expect((await POST(req('POST', { action: 'SOUMETTRE' }), p)).status).toBe(200)
    expect(m.evalUpdate.mock.calls[0][0].data).toMatchObject({ statut: 'SOUMISE', evaluePar: 'user1' })
    m.evalFind.mockResolvedValue({ id: 'e1', statut: 'SOUMISE', actuelle: COMPLETE, cible: null })
    const refus = await POST(req('POST', { action: 'VALIDER' }), p)
    expect(refus.status).toBe(403); expect((await refus.json()).error).toBe('role_validateur_requis')
    m.scope.mockResolvedValue(scope('RSSI'))
    expect((await POST(req('POST', { action: 'VALIDER' }), p)).status).toBe(200)
    expect(m.evalUpdate.mock.calls.at(-1)![0].data).toMatchObject({ statut: 'VALIDEE', validePar: 'user1' })
    expect(m.evalUpdate.mock.calls.at(-1)![0].data.valideLe).toBeInstanceOf(Date)
  })
})
