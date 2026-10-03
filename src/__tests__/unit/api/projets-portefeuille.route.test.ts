import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), cfg: vi.fn(), find: vi.fn(), audit: vi.fn(), rl: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.cfg }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findMany: m.find }, organization: { findUnique: vi.fn(async () => ({ nom: 'Acme' })) } } }))
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => m.audit(...a), getClientIp: () => '' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_EXPORT: { limit: 5, windowMs: 1000 } }))
import { GET } from '@/app/api/projets/portefeuille/route'

const req = (q = '') => ({ nextUrl: new URL(`http://x/api/projets/portefeuille${q}`), headers: new Headers() }) as never

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset())
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'RSSI' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI', scope: { kind: 'org' } })
  m.cfg.mockResolvedValue({ projets360Active: true, appetitRisque: { seuilGlobal: 8, parCategorie: {} } })
  m.rl.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 })
  m.find.mockResolvedValue([{ id: 'p1', nom: 'Projet A', statut: 'EN_COURS', risques: [{ id: 'r1', nom: 'x', domaine: 'CYBER', niveauRisque: 12, niveauResiduel: null }] }])
})

describe('GET /api/projets/portefeuille', () => {
  it('401 sans session ; vide (200) si le module Projets 360 est inactif', async () => {
    m.session.mockResolvedValue(null); expect((await GET(req())).status).toBe(401)
    m.session.mockResolvedValue({ user: { id: 'u1' } }); m.cfg.mockResolvedValue({ projets360Active: false })
    const res = await GET(req()); expect(res.status).toBe(200); expect((await res.json()).projets).toEqual([])
  })
  it('renvoie la carte de chaleur, bornée à l’organisation active et au périmètre de l’utilisateur', async () => {
    const j = await (await GET(req())).json()
    expect(j.appetit).toBe(8); expect(j.projets[0].parDomaine.CYBER).toMatchObject({ count: 1, maxEffectif: 12, auDessusAppetit: 1 })
    const where = m.find.mock.calls[0][0].where
    expect(where).toMatchObject({ organizationId: 'o1', methode: 'PROJET_360', deletedAt: null })
  })
  it('filtre le portefeuille par les patterns d’architecture explicitement demandés', async () => {
    await GET(req('?patterns=EXPOSITION_INTERNET,INTERCO_TIERS,inconnu'))
    const where = m.find.mock.calls[0][0].where
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ OR: [
        { patternsArchi: { array_contains: 'EXPOSITION_INTERNET' } },
        { patternsArchi: { array_contains: 'INTERCO_TIERS' } },
      ] }),
    ]))
  })
  it('export Excel : fichier .xlsx, débit limité, export journalisé', async () => {
    const res = await GET(req('?format=xlsx&lang=fr'))
    expect(res.status).toBe(200); expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
    expect(m.audit).toHaveBeenCalledWith('EXPORT', expect.objectContaining({ targetType: 'projets-portefeuille' }))
    m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 }); expect((await GET(req('?format=xlsx'))).status).toBe(429)
  })
})
