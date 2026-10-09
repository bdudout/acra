// @vitest-environment node
// Revue périodique d'un tiers (PATCH /api/tier-registry/[id]) : gestionnaire du registre de l'organisation RACINE seulement ;
// une filiale à laquelle le tiers est accordé ne modifie pas l'identité du groupe ; date invalide ou future refusée.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), rl: vi.fn(), audit: vi.fn(), granted: vi.fn(), tierFindUnique: vi.fn(), tierUpdate: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_API_WRITE: { limit: 60, windowMs: 60_000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/prisma', () => ({ prisma: { tierOrganization: { findUnique: m.granted }, tier: { findUnique: m.tierFindUnique, update: m.tierUpdate } } }))
import { PATCH } from '@/app/api/tier-registry/[id]/route'

const req = (body: object) => new NextRequest('http://x/api', { method: 'PATCH', body: JSON.stringify(body) })
const p = { params: Promise.resolve({ id: 't1' }) }
const scope = (role: string, org = 'root1') => ({ role, activeOrgId: org, scope: { visibleOrgIds: [org], isSuperAdmin: false } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue(scope('RSSI'))
  m.rl.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 })
  m.granted.mockResolvedValue({ tierId: 't1' })
  m.tierFindUnique.mockResolvedValue({ rootOrganizationId: 'root1' })
})

describe('PATCH /api/tier-registry/[id] — revue périodique', () => {
  it('organisation racine, gestionnaire : date enregistrée et journalisée', async () => {
    const res = await PATCH(req({ derniereRevue: '2026-09-30' }), p)
    expect(res.status).toBe(200)
    expect(m.tierUpdate).toHaveBeenCalledWith({ where: { id: 't1' }, data: { derniereRevue: new Date('2026-09-30T00:00:00Z') } })
    expect(m.audit).toHaveBeenCalled()
  })
  it('filiale à laquelle le tiers est accordé : 403, rien écrit', async () => {
    m.scope.mockResolvedValue(scope('RSSI', 'fil1'))
    expect((await PATCH(req({ derniereRevue: '2026-09-30' }), p)).status).toBe(403)
    expect(m.tierUpdate).not.toHaveBeenCalled()
  })
  it('tiers non accordé : 404 ; rôle sans gestion du registre : 403', async () => {
    m.granted.mockResolvedValue(null)
    expect((await PATCH(req({ derniereRevue: '2026-09-30' }), p)).status).toBe(404)
    m.granted.mockResolvedValue({ tierId: 't1' }); m.scope.mockResolvedValue(scope('ANALYSTE'))
    expect((await PATCH(req({ derniereRevue: '2026-09-30' }), p)).status).toBe(403)
    expect(m.tierUpdate).not.toHaveBeenCalled()
  })
  it('date future ou invalide : 400', async () => {
    expect((await PATCH(req({ derniereRevue: '2999-01-01' }), p)).status).toBe(400)
    expect((await PATCH(req({ derniereRevue: 'hier' }), p)).status).toBe(400)
    expect(m.tierUpdate).not.toHaveBeenCalled()
  })
})
