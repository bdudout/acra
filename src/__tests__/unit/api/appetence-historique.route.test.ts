import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), find: vi.fn(), capture: vi.fn(), audit: vi.fn(), rl: vi.fn(), orgs: vi.fn(), cronAuth: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/prisma', () => ({ prisma: { appetenceSnapshot: { findMany: m.find }, organization: { findUnique: vi.fn(async () => ({ nom: 'Acme' })), findMany: m.orgs } } }))
vi.mock('@/lib/appetit-historique.server', () => ({ capturerInstantane: m.capture }))
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => m.audit(...a), getClientIp: () => '' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_EXPORT: { limit: 5, windowMs: 1 }, LIMIT_API_WRITE: { limit: 5, windowMs: 1 } }))
vi.mock('@/lib/cron-auth', () => ({ assertCronAuth: m.cronAuth }))
const appetence = vi.hoisted(() => ({ active: true }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ appetenceActive: appetence.active })) }))
import { GET, POST } from '@/app/api/appetence/historique/route'
import { POST as CRON } from '@/app/api/cron/appetence-snapshots/route'

const req = (q = '') => ({ nextUrl: new URL(`http://x/api/appetence/historique${q}`), headers: new Headers() }) as never
const resume = (hors: number) => ({ global: 'VERT', appetit: { evalues: 10, horsAppetit: hors, seuilGlobal: 8, voyant: 'VERT' }, maturite: [], kri: { total: 3, alerte: 0, critique: 0, voyant: 'VERT' } })

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset()); appetence.active = true
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'RSSI' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
  m.rl.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 })
  m.find.mockResolvedValue([{ periode: '2026-10', resume: resume(2) }, { periode: '2026-09', resume: resume(5) }])
  m.capture.mockResolvedValue({ periode: '2026-10', cree: true })
})

describe('/api/appetence/historique', () => {
  it('401 sans session ; 403 sans lecture globale du dispositif', async () => {
    m.session.mockResolvedValue(null); expect((await GET(req())).status).toBe(401)
    m.session.mockResolvedValue({ user: { id: 'u1' } }); m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'LECTEUR' })
    expect((await GET(req())).status).toBe(403)
  })
  it('liste les instantanés de l’organisation active avec leurs tendances (ancien → récent)', async () => {
    const j = await (await GET(req())).json()
    expect(m.find.mock.calls[0][0].where).toEqual({ organizationId: 'o1' })
    expect(j.tendances.map((t: { periode: string }) => t.periode)).toEqual(['2026-09', '2026-10'])
    expect(j.tendances[1]).toMatchObject({ sens: 'AMELIORATION', delta: { horsAppetit: -3 } }); expect(j.canWrite).toBe(true)
  })
  it('capture manuelle réservée aux rôles d’écriture ; journalisée ; débit limité', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'AUDITEUR' })
    expect((await POST(req())).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RISK_MANAGER' })
    const res = await POST(req()); expect(res.status).toBe(201)
    expect(m.capture).toHaveBeenCalledWith('o1', expect.objectContaining({ userId: 'u1', ecraser: true }))
    expect(m.audit).toHaveBeenCalled()
    m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 }); expect((await POST(req())).status).toBe(429)
  })
  it('module inactif → 404 ; export Excel journalisé', async () => {
    m.capture.mockResolvedValue(null); expect((await POST(req())).status).toBe(404)
    const x = await GET(req('?format=xlsx')); expect(x.headers.get('Content-Type')).toContain('spreadsheetml')
    expect(m.audit).toHaveBeenCalledWith('EXPORT', expect.objectContaining({ targetType: 'appetence-historique' }))
  })
  it('module « Appétence » coupé pour l’organisation : historique fermé (404), rien n’est lu ni figé', async () => {
    appetence.active = false
    expect((await GET(req())).status).toBe(404)
    expect((await POST(req())).status).toBe(404)
    expect(m.find).not.toHaveBeenCalled(); expect(m.capture).not.toHaveBeenCalled()
  })
})

describe('cron appetence-snapshots', () => {
  it('refuse sans secret ; capture sans écraser pour chaque organisation ; une organisation en échec ne bloque pas les autres', async () => {
    m.cronAuth.mockReturnValue(NextResponseLike(401)); expect((await CRON({} as never)).status).toBe(401)
    m.cronAuth.mockReturnValue(null)
    m.orgs.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    m.capture.mockImplementation(async (id: string) => { if (id === 'b') throw new Error('x'); return id === 'a' ? { periode: '2026-10', cree: true } : null })
    const j = await (await CRON({} as never)).json()
    expect(j).toMatchObject({ ok: true, organisations: 3, crees: 1 })
    expect(m.capture).toHaveBeenCalledWith('a', expect.objectContaining({ userId: null, ecraser: false }))
  })
})
function NextResponseLike(status: number) { return new Response('{}', { status }) as never }
