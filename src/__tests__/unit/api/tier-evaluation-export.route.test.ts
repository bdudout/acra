// @vitest-environment node
// Lot T2 — export Excel des évaluations : usages de l'organisation active, ou du sous-arbre VISIBLE pour une tête de
// groupe (jamais une filiale hors périmètre) ; journalisé.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), audit: vi.fn(), cfg: vi.fn(), org: vi.fn(), orgs: vi.fn(), usages: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ allowed: true })), rateLimitHeaders: () => ({}), LIMIT_API_WRITE: { limit: 60, windowMs: 60_000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.cfg }))
vi.mock('@/lib/prisma', () => ({ prisma: { organization: { findUnique: m.org, findMany: m.orgs }, tierServiceUsage: { findMany: m.usages } } }))
import { GET } from '@/app/api/tier-registry/export/route'

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ role: 'RSSI', activeOrgId: 'grp', scope: { visibleOrgIds: ['grp', 'fil1'], isSuperAdmin: false } })
  m.cfg.mockResolvedValue({ echellesEcosysteme: null })
  m.org.mockResolvedValue({ path: '/grp/' })
  m.orgs.mockResolvedValue([{ id: 'grp', nom: 'Groupe' }, { id: 'fil1', nom: 'Filiale Nord' }, { id: 'fil2', nom: 'Hors périmètre' }])
  m.usages.mockResolvedValue([{ organizationId: 'fil1', useCase: 'Paie', criticite: 'CRITIQUE', processus: { nom: 'Paie' }, tierService: { nom: 'IaaS', tier: { nom: 'Hébergeur' } }, evaluation: { statut: 'VALIDEE', actuelle: { dependance: 4, penetration: 3, maturite: 2, confiance: 2 }, cible: null, clauses: ['securite'], valideLe: new Date('2026-10-01') } }])
})

describe('GET /api/tier-registry/export', () => {
  it('classeur Excel des usages du sous-arbre visible ; journalisé', async () => {
    const res = await GET(new NextRequest('http://x/api/tier-registry/export?lang=fr'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
    expect(m.usages.mock.calls[0][0].where.organizationId).toEqual({ in: ['grp', 'fil1'] })
    expect(m.audit).toHaveBeenCalled()
  })
  it('non connecté : 401', async () => {
    m.session.mockResolvedValue(null)
    expect((await GET(new NextRequest('http://x/api/tier-registry/export'))).status).toBe(401)
  })
})
