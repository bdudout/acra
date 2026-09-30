// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  session: vi.fn(), scope: vi.fn(), rl: vi.fn(), audit: vi.fn(), tx: vi.fn(), queryRaw: vi.fn(),
  tierOrgFindUnique: vi.fn(), tierOrgCount: vi.fn(), tierOrgDeleteMany: vi.fn(),
  tierFindMany: vi.fn(), tierUpdate: vi.fn(), tierDelete: vi.fn(),
  arrCount: vi.fn(), arrUpdateMany: vi.fn(), ppCount: vi.fn(), ppUpdateMany: vi.fn(),
  svcCount: vi.fn(), svcUpdateMany: vi.fn(), usageCount: vi.fn(), models: undefined as unknown as () => object,
}))
m.models = () => ({
  tierOrganization: { findUnique: m.tierOrgFindUnique, count: m.tierOrgCount, deleteMany: m.tierOrgDeleteMany },
  tier: { findMany: m.tierFindMany, update: m.tierUpdate, delete: m.tierDelete },
  arrangementTic: { count: m.arrCount, updateMany: m.arrUpdateMany }, partiePrenante: { count: m.ppCount, updateMany: m.ppUpdateMany },
  tierService: { count: m.svcCount, updateMany: m.svcUpdateMany }, tierServiceUsage: { count: m.usageCount }, $queryRaw: m.queryRaw,
})
const models = () => m.models()
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_API_WRITE: { limit: 60, windowMs: 60_000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k: string) => (k === '$transaction' ? m.tx : (m.models() as Record<string, unknown>)[k]) }) }))
import { GET, POST } from '@/app/api/tier-registry/merge/route'

const S = { id: 'tS', nom: 'ACME LOGICIELS SAS', lei: null, pays: null, aliases: [], rootOrganizationId: 'grp' }
const T = { id: 'tT', nom: 'Acme Logiciels', lei: '549300ABCDEFGHIJ1234', pays: 'FR', aliases: ['Acme'], rootOrganizationId: 'grp' }
const req = (qs: string, body?: object) => new NextRequest(`http://x/api/tier-registry/merge${qs}`, body ? { method: 'POST', body: JSON.stringify(body) } : undefined)
const scope = (role: string) => ({ role, activeOrgId: 'fil1', scope: { visibleOrgIds: ['fil1'], isSuperAdmin: false } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue(scope('ADMIN'))
  m.rl.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 })
  m.tierOrgFindUnique.mockResolvedValue({ tierId: 'x' })
  m.tierFindMany.mockResolvedValue([S, T])
  m.tierOrgCount.mockResolvedValue(0)
  m.arrCount.mockImplementation(async ({ where }: { where: { organizationId?: unknown } }) => (where.organizationId === undefined ? 2 : 2)) // total = dans l'org
  m.ppCount.mockResolvedValue(3); m.svcCount.mockResolvedValue(1); m.usageCount.mockResolvedValue(4)
  m.tx.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(models()))
  m.tierUpdate.mockResolvedValue({}); m.tierDelete.mockResolvedValue({})
})

describe('GET /api/tier-registry/merge — aperçu de toutes les relations', () => {
  it('compte ce qui sera déplacé (contrats, parties prenantes, offres, usages) sans rien écrire', async () => {
    const res = await GET(req('?sourceId=tS&targetId=tT'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, source: { id: 'tS', nom: 'ACME LOGICIELS SAS' }, target: { id: 'tT', nom: 'Acme Logiciels' }, counts: { arrangements: 2, parties: 3, services: 1, usages: 4 } })
    expect(m.arrUpdateMany).not.toHaveBeenCalled(); expect(m.tierDelete).not.toHaveBeenCalled()
  })
  it('bloque avec une raison claire si la fusion toucherait une autre organisation', async () => {
    m.tierOrgCount.mockResolvedValue(1)
    const body = await (await GET(req('?sourceId=tS&targetId=tT'))).json()
    expect(body).toMatchObject({ ok: false, error: 'shared_with_other_organizations' })
  })
  it('tiers non autorisé pour l’organisation : 404 ; paramètres manquants : 400 ; analyste : 403', async () => {
    m.tierOrgFindUnique.mockResolvedValue(null)
    expect((await GET(req('?sourceId=tS&targetId=tT'))).status).toBe(404)
    m.tierOrgFindUnique.mockResolvedValue({ tierId: 'x' })
    expect((await GET(req('?sourceId=tS'))).status).toBe(400)
    m.scope.mockResolvedValue(scope('ANALYSTE')); expect((await GET(req('?sourceId=tS&targetId=tT'))).status).toBe(403)
  })
})

describe('POST /api/tier-registry/merge', () => {
  it('déplace contrats, parties prenantes et offres vers le tiers conservé, garde le nom absorbé comme alias, supprime l’ancien tiers (transaction verrouillée, journalisée)', async () => {
    const res = await POST(req('', { sourceId: 'tS', targetId: 'tT' }))
    expect(res.status).toBe(200)
    expect(m.queryRaw).toHaveBeenCalled()
    expect(m.arrUpdateMany.mock.calls[0][0]).toEqual({ where: { tierId: 'tS', organizationId: 'fil1' }, data: { tierId: 'tT' } })
    expect(m.ppUpdateMany.mock.calls[0][0]).toEqual({ where: { tierId: 'tS' }, data: { tierId: 'tT' } })
    expect(m.svcUpdateMany.mock.calls[0][0]).toEqual({ where: { tierId: 'tS' }, data: { tierId: 'tT' } })
    expect(m.tierOrgDeleteMany.mock.calls[0][0]).toEqual({ where: { tierId: 'tS' } })
    expect(m.tierUpdate.mock.calls[0][0]).toMatchObject({ where: { id: 'tT' }, data: { aliases: ['Acme'] } }) // « ACME LOGICIELS SAS » = nom conservé à la forme juridique près
    expect(m.tierDelete).toHaveBeenCalledWith({ where: { id: 'tS' } })
    expect(m.audit).toHaveBeenCalled()
  })
  it('LEI porté par la source et absent de la cible : repris par la cible ; LEI différents : 409 sans rien modifier', async () => {
    m.tierFindMany.mockResolvedValue([{ ...S, lei: '549300ZZZZZZZZZZZZ99', pays: 'DE' }, { ...T, lei: null, pays: null }])
    await POST(req('', { sourceId: 'tS', targetId: 'tT' }))
    expect(m.tierUpdate.mock.calls[0][0].data).toMatchObject({ lei: '549300ZZZZZZZZZZZZ99', pays: 'DE' })
    vi.clearAllMocks(); m.session.mockResolvedValue({ user: { id: 'u1' } }); m.scope.mockResolvedValue(scope('ADMIN')); m.rl.mockResolvedValue({ allowed: true, remaining: 1, resetAt: 0 })
    m.tierOrgFindUnique.mockResolvedValue({ tierId: 'x' }); m.tierOrgCount.mockResolvedValue(0); m.arrCount.mockResolvedValue(0); m.ppCount.mockResolvedValue(0); m.svcCount.mockResolvedValue(0); m.usageCount.mockResolvedValue(0)
    m.tx.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(models()))
    m.tierFindMany.mockResolvedValue([{ ...S, lei: '549300AAAAAAAAAAAA11' }, { ...T, lei: '549300BBBBBBBBBBBB22' }])
    const res = await POST(req('', { sourceId: 'tS', targetId: 'tT' }))
    expect(res.status).toBe(409); expect((await res.json()).error).toBe('lei_conflict')
    expect(m.tierDelete).not.toHaveBeenCalled()
  })
  it('exposition à une autre organisation recontrôlée DANS la transaction : 409, aucune écriture', async () => {
    m.ppCount.mockImplementation(async ({ where }: { where: { analyse?: unknown } }) => (where.analyse ? 1 : 5)) // 5 au total, 1 dans l'org ⇒ 4 ailleurs
    const res = await POST(req('', { sourceId: 'tS', targetId: 'tT' }))
    expect(res.status).toBe(409); expect((await res.json()).error).toBe('shared_with_other_organizations')
    expect(m.tierDelete).not.toHaveBeenCalled(); expect(m.arrUpdateMany).not.toHaveBeenCalled()
  })
  it('limite de débit : 429', async () => {
    m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 1 })
    expect((await POST(req('', { sourceId: 'tS', targetId: 'tT' }))).status).toBe(429)
  })
})
