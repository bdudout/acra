/** Import de risques cyber dans un projet 360 : les tiers de l'analyse source suivent, sauf refus explicite. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  analyse: { findFirst: vi.fn(), findMany: vi.fn() },
  risque: { findMany: vi.fn(), createMany: vi.fn() },
  partiePrenante: { findMany: vi.fn(), createMany: vi.fn() },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'RSSI' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/analyse-direct-risk.server', () => ({ guardDirectRisk: vi.fn(async () => ({ ok: true, analyse: { id: 'p', methode: 'PROJET_360', organizationId: 'o' } })) }))
vi.mock('@/lib/org-context.server', () => ({ getEffectiveRoleForOrg: vi.fn(async () => 'RSSI') }))
vi.mock('@/lib/configuration-server', () => ({ getEffectiveScaleConfig: vi.fn(async () => ({ nbNiveaux: 4 })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ allowed: true })), rateLimitHeaders: () => ({}), LIMIT_API_WRITE: { limit: 1, windowMs: 1 } }))

import { GET, POST } from '@/app/api/analyses/[id]/import-cyber/route'

const PP = { nom: 'Hébergeur cloud', type: 'FOURNISSEUR', description: null, tierId: 't1', dependance: 4, penetration: 3, maturite: 4, confiance: 3, critique: false, rang: 1 }
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never
const params = { params: Promise.resolve({ id: 'p' }) }
const getReq = (qs: string) => ({ nextUrl: new URL('http://x/api' + qs), headers: new Headers() }) as never

beforeEach(() => {
  vi.clearAllMocks()
  db.analyse.findFirst.mockResolvedValue({ id: 's', nom: 'Cyber', risques: [], partiesPrenantes: [PP] })
  db.analyse.findMany.mockResolvedValue([{ id: 's', nom: 'Cyber', methode: 'EBIOS_RM', risques: [], _count: { partiesPrenantes: 1 } }])
  db.risque.findMany.mockResolvedValue([])
  db.partiePrenante.findMany.mockResolvedValue([])
  db.partiePrenante.createMany.mockResolvedValue({ count: 1 })
})

describe('import-cyber : tiers', () => {
  it('GET sans source : liste légère (recherche, 20 au plus), sans charger les risques', async () => {
    db.analyse.findMany.mockResolvedValueOnce([{ id: 's', nom: 'Cyber', methode: 'EBIOS_RM', updatedAt: new Date(), _count: { risques: 4, partiesPrenantes: 1 } }])
    const body = await (await GET(getReq('?q=cyb'), params)).json()
    const arg = db.analyse.findMany.mock.calls[0][0]
    expect(arg.take).toBeLessThanOrEqual(20)
    expect(arg.where).toMatchObject({ nom: { contains: 'cyb', mode: 'insensitive' } })
    expect(arg.select.risques).toBeUndefined()
    expect(body.sources[0]).toMatchObject({ id: 's', nbRisques: 4, nbTiers: 1 })
  })
  it('GET ?source= : les risques de cette seule analyse, marqués « déjà importé »', async () => {
    db.analyse.findFirst.mockResolvedValueOnce({ id: 's', nom: 'Cyber', methode: 'EBIOS_RM', risques: [{ id: 'r1', nom: 'R1', niveauRisque: 9 }], _count: { partiesPrenantes: 1 } })
    db.risque.findMany.mockResolvedValueOnce([{ sourceRisqueId: 'r1' }])
    const body = await (await GET(getReq('?source=s'), params)).json()
    expect(body.source).toMatchObject({ id: 's', nbTiers: 1, risques: [{ id: 'r1', alreadyImported: true }] })
  })
  it('GET ?source= hors périmètre : 404', async () => {
    db.analyse.findFirst.mockResolvedValueOnce(null)
    expect((await GET(getReq('?source=autre'), params)).status).toBe(404)
  })
  it('import des tiers seuls (aucun risque sélectionné)', async () => {
    const body = await (await POST(req({ sourceAnalyseId: 's', risqueIds: [], importerTiers: true }), params)).json()
    expect(body).toMatchObject({ imported: 0, tiers: 1 })
  })
  it('par défaut, les tiers de la source sont importés (sans doublon)', async () => {
    const body = await (await POST(req({ sourceAnalyseId: 's', risqueIds: [] }), params)).json()
    expect(db.partiePrenante.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ analyseId: 'p', nom: 'Hébergeur cloud', tierId: 't1' })] })
    expect(body.tiers).toBe(1)
  })
  it('importerTiers: false → aucun tiers importé', async () => {
    await POST(req({ sourceAnalyseId: 's', risqueIds: [], importerTiers: false }), params)
    expect(db.partiePrenante.createMany).not.toHaveBeenCalled()
  })
})
