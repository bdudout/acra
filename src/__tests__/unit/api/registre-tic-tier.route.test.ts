// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), cfg: vi.fn(), audit: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), tierOrgFindUnique: vi.fn(), tierOrgFindMany: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.cfg }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/tiers.server', () => ({ consolidatedTiersForOrg: vi.fn(async () => []) }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  arrangementTic: { create: m.create, update: m.update, findFirst: m.findFirst, findMany: m.findMany },
  tierOrganization: { findUnique: m.tierOrgFindUnique, findMany: m.tierOrgFindMany },
} }))
import { GET, POST } from '@/app/api/reglementaire/registre-tic/route'
import { PATCH } from '@/app/api/reglementaire/registre-tic/[id]/route'

const base = { reference: 'C-1', prestataireNom: 'Acme', typeService: 'CLOUD', criticite: 'NON_CRITIQUE' }
const req = (body?: object, method = 'POST') => new NextRequest('http://x/api/reglementaire/registre-tic', { method, ...(body ? { body: JSON.stringify(body) } : {}) })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ role: 'RSSI', activeOrgId: 'org1' })
  m.cfg.mockResolvedValue({ reglementaireActive: true })
  m.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'new', ...data }))
  m.update.mockImplementation(async ({ data }: { data: object }) => ({ id: 'a1', ...data }))
  m.findFirst.mockResolvedValue({ id: 'a1' })
  m.findMany.mockResolvedValue([])
  m.tierOrgFindUnique.mockResolvedValue({ tierId: 't1' })
  m.tierOrgFindMany.mockResolvedValue([{ tier: { id: 't1', nom: 'Acme', lei: null, pays: 'FR' } }])
})

describe('registre TIC — choix d’une identité de tiers à la saisie', () => {
  it('POST : rattache l’arrangement au tiers choisi, à condition qu’il soit autorisé pour l’organisation', async () => {
    const res = await POST(req({ ...base, tierId: 't1' }))
    expect(res.status).toBe(201)
    expect(m.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'org1', tierId: 't1', prestataireNom: 'Acme' })
    expect(m.tierOrgFindUnique.mock.calls[0][0].where).toEqual({ tierId_organizationId: { tierId: 't1', organizationId: 'org1' } })
  })
  it('POST : tiers non autorisé (autre organisation, inexistant) : 400 « tier_invalide », rien n’est créé', async () => {
    m.tierOrgFindUnique.mockResolvedValue(null)
    const res = await POST(req({ ...base, tierId: 'tEtranger' }))
    expect(res.status).toBe(400); expect((await res.json()).error).toBe('tier_invalide')
    expect(m.create).not.toHaveBeenCalled()
  })
  it('POST sans tierId : comportement inchangé (pas de tierId écrit)', async () => {
    await POST(req(base))
    expect(m.create.mock.calls[0][0].data).not.toHaveProperty('tierId')
    expect(m.tierOrgFindUnique).not.toHaveBeenCalled()
  })
  it('PATCH : tierId absent = lien inchangé (le questionnaire renvoie l’arrangement sans tierId) ; null = détache ; valeur = rattache', async () => {
    const params = { params: Promise.resolve({ id: 'a1' }) }
    await PATCH(req(base, 'PATCH'), params)
    expect(m.update.mock.calls[0][0].data).not.toHaveProperty('tierId')
    await PATCH(req({ ...base, tierId: null }, 'PATCH'), params)
    expect(m.update.mock.calls[1][0].data).toMatchObject({ tierId: null })
    await PATCH(req({ ...base, tierId: 't1' }, 'PATCH'), params)
    expect(m.update.mock.calls[2][0].data).toMatchObject({ tierId: 't1' })
    m.tierOrgFindUnique.mockResolvedValue(null)
    expect((await PATCH(req({ ...base, tierId: 'tX' }, 'PATCH'), params))?.status).toBe(400)
  })
  it('GET : propose les identités autorisées (liste de choix) avec chaque arrangement', async () => {
    m.findMany.mockResolvedValue([{ id: 'a1', reference: 'C-1', prestataireNom: 'Acme', tierId: 't1', typeService: 'CLOUD', criticite: 'NON_CRITIQUE', questionnaire: [] }])
    const body = await (await GET(req(undefined, 'GET'))).json()
    expect(body.tiersOptions).toEqual([{ id: 't1', nom: 'Acme', lei: null, pays: 'FR' }])
    expect(body.arrangements[0]?.tierId).toBe('t1')
  })
})
