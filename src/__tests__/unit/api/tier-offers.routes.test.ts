// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  session: vi.fn(), scope: vi.fn(), rl: vi.fn(), audit: vi.fn(),
  tierOrgFindUnique: vi.fn(), tierFindUnique: vi.fn(),
  svcFindMany: vi.fn(), svcFindUnique: vi.fn(), svcCreate: vi.fn(), svcUpdate: vi.fn(),
  arrFindMany: vi.fn(), arrFindFirst: vi.fn(),
  tcsFindMany: vi.fn(), tcsCreateMany: vi.fn(), tcsDeleteMany: vi.fn(),
  usageFindMany: vi.fn(), usageFindUnique: vi.fn(), usageDelete: vi.fn(), usageGroupBy: vi.fn(),
  procFindMany: vi.fn(), tx: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_API_WRITE: { limit: 60, windowMs: 60_000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  tierOrganization: { findUnique: m.tierOrgFindUnique }, tier: { findUnique: m.tierFindUnique },
  tierService: { findMany: m.svcFindMany, findUnique: m.svcFindUnique, create: m.svcCreate, update: m.svcUpdate },
  arrangementTic: { findMany: m.arrFindMany, findFirst: m.arrFindFirst },
  tierContractService: { findMany: m.tcsFindMany, createMany: m.tcsCreateMany, deleteMany: m.tcsDeleteMany },
  tierServiceUsage: { findMany: m.usageFindMany, findUnique: m.usageFindUnique, delete: m.usageDelete, groupBy: m.usageGroupBy },
  processus: { findMany: m.procFindMany }, $transaction: m.tx,
} }))
import { GET as DETAIL } from '@/app/api/tier-registry/[id]/route'
import { POST as ADD_SERVICE } from '@/app/api/tier-registry/[id]/services/route'
import { PATCH as EDIT_SERVICE } from '@/app/api/tier-registry/services/[serviceId]/route'
import { PUT as SET_COVERAGE } from '@/app/api/tier-registry/contracts/[arrangementId]/services/route'
import { DELETE as DELETE_USAGE } from '@/app/api/tier-registry/usages/[usageId]/route'

const req = (body?: object, method = 'POST') => new NextRequest('http://x/api', { method, ...(body ? { body: JSON.stringify(body) } : {}) })
const p = <T extends object>(o: T) => ({ params: Promise.resolve(o) })
const scope = (role: string) => ({ role, activeOrgId: 'fil1', scope: { visibleOrgIds: ['fil1'], isSuperAdmin: false } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue(scope('ADMIN'))
  m.rl.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 })
  m.tierOrgFindUnique.mockResolvedValue({ tierId: 't1' })
  m.tierFindUnique.mockResolvedValue({ id: 't1', nom: 'Acme', lei: null, pays: 'FR' })
  m.svcFindMany.mockResolvedValue([]); m.arrFindMany.mockResolvedValue([]); m.tcsFindMany.mockResolvedValue([]); m.usageFindMany.mockResolvedValue([]); m.procFindMany.mockResolvedValue([])
  m.usageGroupBy.mockResolvedValue([])
  m.svcCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 's-new', ...data }))
  m.svcUpdate.mockImplementation(async ({ data }: { data: object }) => ({ id: 's1', ...data }))
  m.tx.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ tierContractService: { findMany: m.tcsFindMany, createMany: m.tcsCreateMany, deleteMany: m.tcsDeleteMany }, tierServiceUsage: { groupBy: m.usageGroupBy } }))
})

describe('GET /api/tier-registry/[id] — fiche d’un tiers', () => {
  it('offres, contrats de l’organisation ou groupe confirmés, usages de l’organisation avec leur couverture', async () => {
    m.svcFindMany.mockResolvedValue([{ id: 's1', nom: 'SignNow Signature', typeService: 'LOGICIEL', description: null, actif: true }, { id: 's2', nom: 'Hébergement A', typeService: 'HEBERGEMENT', description: null, actif: true }])
    m.arrFindMany.mockResolvedValue([
      { id: 'a1', reference: 'C-1', organizationId: 'fil1', beneficiaries: [], servicesCouverts: [{ id: 'cs1', tierServiceId: 's1' }] },
      { id: 'aG', reference: 'C-G', organizationId: 'grp', beneficiaries: [{ organizationId: 'fil1', status: 'CONFIRMED' }], servicesCouverts: [{ id: 'cs2', tierServiceId: 's1' }] },
    ])
    m.usageFindMany.mockResolvedValue([
      { id: 'u1', useCase: 'Contrats fournisseurs', tierServiceId: 's1', processusId: 'p1', processus: { nom: 'Achats' }, contractServiceId: 'cs1' },
      { id: 'u2', useCase: 'Contrats de travail', tierServiceId: 's1', processusId: 'p2', processus: { nom: 'RH' }, contractServiceId: null },
    ])
    const res = await DETAIL(req(undefined, 'GET'), p({ id: 't1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orgId).toBe('fil1')
    const s1 = body.services.find((s: { id: string }) => s.id === 's1')
    expect(s1.coveredBy.map((c: { reference: string }) => c.reference)).toEqual(['C-1', 'C-G'])
    expect(s1.usages.map((u: { useCase: string; coverage: string; processusNom: string }) => [u.useCase, u.coverage, u.processusNom])).toEqual([['Contrats fournisseurs', 'CONFIRMED', 'Achats'], ['Contrats de travail', 'UNCONFIRMED', 'RH']])
    expect(body.services.find((s: { id: string }) => s.id === 's2').usages).toEqual([])
    expect(body.contracts.map((c: { reference: string; ownedHere: boolean }) => [c.reference, c.ownedHere])).toEqual([['C-1', true], ['C-G', false]])
    // isolation : usages lus pour l'organisation active seulement ; contrats = les siens ou groupe dont elle est bénéficiaire confirmée
    expect(m.usageFindMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'fil1' })
    expect(JSON.stringify(m.arrFindMany.mock.calls[0][0].where)).toContain('CONFIRMED')
  })
  it('tiers non autorisé pour l’organisation : 404', async () => {
    m.tierOrgFindUnique.mockResolvedValue(null)
    expect((await DETAIL(req(undefined, 'GET'), p({ id: 'tEtranger' }))).status).toBe(404)
  })
})

describe('POST /api/tier-registry/[id]/services — ajouter une offre', () => {
  it('crée l’offre (catégorie = simple attribut), journalise', async () => {
    const res = await ADD_SERVICE(req({ nom: 'SignNow Signature', typeService: 'LOGICIEL' }), p({ id: 't1' }))
    expect(res.status).toBe(201)
    expect(m.svcCreate.mock.calls[0][0].data).toMatchObject({ tierId: 't1', nom: 'SignNow Signature', typeService: 'LOGICIEL' })
    expect(m.audit).toHaveBeenCalled()
  })
  it('deux offres de même catégorie restent permises', async () => {
    await ADD_SERVICE(req({ nom: 'Hébergement A', typeService: 'HEBERGEMENT' }), p({ id: 't1' }))
    expect((await ADD_SERVICE(req({ nom: 'Hébergement B', typeService: 'HEBERGEMENT' }), p({ id: 't1' }))).status).toBe(201)
  })
  it('validation, droits (analyste 403), tiers non autorisé (404)', async () => {
    expect((await ADD_SERVICE(req({ nom: '' }), p({ id: 't1' }))).status).toBe(400)
    m.scope.mockResolvedValue(scope('ANALYSTE')); expect((await ADD_SERVICE(req({ nom: 'X' }), p({ id: 't1' }))).status).toBe(403)
    m.scope.mockResolvedValue(scope('ADMIN')); m.tierOrgFindUnique.mockResolvedValue(null)
    expect((await ADD_SERVICE(req({ nom: 'X' }), p({ id: 'tE' }))).status).toBe(404)
  })
})

describe('PATCH /api/tier-registry/services/[serviceId]', () => {
  it('renomme ou désactive une offre d’un tiers autorisé', async () => {
    m.svcFindUnique.mockResolvedValue({ id: 's1', tierId: 't1' })
    const res = await EDIT_SERVICE(req({ nom: 'Nouveau nom', actif: false }, 'PATCH'), p({ serviceId: 's1' }))
    expect(res.status).toBe(200)
    expect(m.svcUpdate.mock.calls[0][0]).toMatchObject({ where: { id: 's1' }, data: { nom: 'Nouveau nom', actif: false } })
  })
  it('offre d’un tiers non autorisé : 404', async () => {
    m.svcFindUnique.mockResolvedValue({ id: 's9', tierId: 'tE' }); m.tierOrgFindUnique.mockResolvedValue(null)
    expect((await EDIT_SERVICE(req({ actif: false }, 'PATCH'), p({ serviceId: 's9' }))).status).toBe(404)
  })
})

describe('PUT /api/tier-registry/contracts/[arrangementId]/services — offres couvertes', () => {
  beforeEach(() => {
    m.arrFindFirst.mockResolvedValue({ id: 'a1', tierId: 't1' })
    m.svcFindMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    m.tcsFindMany.mockResolvedValue([{ id: 'cs1', tierServiceId: 's1' }])
  })
  it('ajoute et retire des offres, seulement celles du tiers du contrat', async () => {
    const res = await SET_COVERAGE(req({ serviceIds: ['s2'] }, 'PUT'), p({ arrangementId: 'a1' }))
    expect(res.status).toBe(200)
    expect(m.tcsCreateMany.mock.calls[0][0].data).toEqual([{ arrangementId: 'a1', tierServiceId: 's2' }])
    expect(m.tcsDeleteMany.mock.calls[0][0].where).toMatchObject({ arrangementId: 'a1', tierServiceId: { in: ['s1'] } })
  })
  it('offre d’un autre tiers : 400 ; contrat sans tiers ou d’une autre organisation : 404', async () => {
    expect((await SET_COVERAGE(req({ serviceIds: ['sAutre'] }, 'PUT'), p({ arrangementId: 'a1' }))).status).toBe(400)
    m.arrFindFirst.mockResolvedValue(null)
    expect((await SET_COVERAGE(req({ serviceIds: [] }, 'PUT'), p({ arrangementId: 'aX' }))).status).toBe(404)
    m.arrFindFirst.mockResolvedValue({ id: 'a1', tierId: null })
    expect((await SET_COVERAGE(req({ serviceIds: [] }, 'PUT'), p({ arrangementId: 'a1' }))).status).toBe(404)
  })
  it('retirer une offre encore utilisée par des usages : 409 avec le nombre d’usages', async () => {
    m.usageGroupBy.mockResolvedValue([{ contractServiceId: 'cs1', _count: { _all: 2 } }])
    const res = await SET_COVERAGE(req({ serviceIds: [] }, 'PUT'), p({ arrangementId: 'a1' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'has_usages', blocked: [{ serviceId: 's1', usages: 2 }] })
    expect(m.tcsDeleteMany).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/tier-registry/usages/[usageId]', () => {
  it('supprime un usage de l’organisation active (ADMIN)', async () => {
    m.usageFindUnique.mockResolvedValue({ id: 'u1', organizationId: 'fil1' })
    expect((await DELETE_USAGE(req(undefined, 'DELETE'), p({ usageId: 'u1' }))).status).toBe(200)
    expect(m.usageDelete).toHaveBeenCalledWith({ where: { id: 'u1' } })
  })
  it('usage d’une autre organisation : 404 ; non admin : 403', async () => {
    m.usageFindUnique.mockResolvedValue({ id: 'u2', organizationId: 'fil2' })
    expect((await DELETE_USAGE(req(undefined, 'DELETE'), p({ usageId: 'u2' }))).status).toBe(404)
    m.scope.mockResolvedValue(scope('RSSI'))
    m.usageFindUnique.mockResolvedValue({ id: 'u1', organizationId: 'fil1' })
    expect((await DELETE_USAGE(req(undefined, 'DELETE'), p({ usageId: 'u1' }))).status).toBe(403)
  })
})
