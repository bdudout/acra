// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  session: vi.fn(), scope: vi.fn(), cfg: vi.fn(), rl: vi.fn(), audit: vi.fn(),
  tierOrgFindMany: vi.fn(), tierOrgFindUnique: vi.fn(), tierFindFirst: vi.fn(), tierCreate: vi.fn(), tierOrgCreate: vi.fn(),
  benFindMany: vi.fn(), arrFindMany: vi.fn(), arrFindFirst: vi.fn(), arrUpdateMany: vi.fn(), arrUpdate: vi.fn(), ppFindMany: vi.fn(), orgFindUnique: vi.fn(), tx: vi.fn(), orgFindMany: vi.fn(), usageFindMany: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.cfg }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_API_WRITE: { limit: 60, windowMs: 60_000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  tierOrganization: { findMany: m.tierOrgFindMany, findUnique: m.tierOrgFindUnique, create: m.tierOrgCreate },
  tier: { findFirst: m.tierFindFirst, create: m.tierCreate },
  arrangementTic: { findMany: m.arrFindMany, findFirst: m.arrFindFirst, updateMany: m.arrUpdateMany, update: m.arrUpdate },
  partiePrenante: { findMany: m.ppFindMany }, tierContractBeneficiary: { findMany: m.benFindMany }, organization: { findUnique: m.orgFindUnique, findMany: m.orgFindMany }, tierServiceUsage: { findMany: m.usageFindMany }, $transaction: m.tx,
} }))
import { GET, POST } from '@/app/api/tier-registry/route'
import { POST as LINK } from '@/app/api/tier-registry/link/route'

const req = (url: string, body?: object) => new NextRequest(`http://x${url}`, body ? { method: 'POST', body: JSON.stringify(body) } : undefined)
const scope = (role: string) => ({ role, activeOrgId: 'fil1', scope: { visibleOrgIds: ['fil1'], isSuperAdmin: false } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue(scope('ADMIN'))
  m.cfg.mockResolvedValue({ reglementaireActive: true })
  m.rl.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 })
  m.tierOrgFindMany.mockResolvedValue([])
  m.arrFindMany.mockResolvedValue([])
  m.ppFindMany.mockResolvedValue([])
  m.benFindMany.mockResolvedValue([])
  m.tierFindFirst.mockResolvedValue(null)
  m.orgFindUnique.mockResolvedValue({ path: '/grp/fil1/' })
  m.orgFindMany.mockResolvedValue([{ id: 'fil1', nom: 'Filiale 1' }])
  m.usageFindMany.mockResolvedValue([])
  m.tierCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 'tNew', ...data }))
  m.tx.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ tier: { create: m.tierCreate }, tierOrganization: { create: m.tierOrgCreate }, arrangementTic: { updateMany: m.arrUpdateMany } }))
  m.arrUpdateMany.mockResolvedValue({ count: 1 })
})

describe('GET /api/tier-registry', () => {
  it('liste les tiers autorisés pour l’organisation, leur couverture (cyber / TIC) et les arrangements à rapprocher avec candidats', async () => {
    m.tierOrgFindMany.mockResolvedValue([
      { tier: { id: 't1', nom: 'Acme', lei: '549300ABCDEFGHIJ1234', pays: 'FR', aliases: [] } },
      { tier: { id: 't2', nom: 'Seul TIC', lei: null, pays: null, aliases: [] } },
      { tier: { id: 't3', nom: 'Seul cyber', lei: null, pays: null, aliases: [] } },
    ])
    m.arrFindMany.mockResolvedValue([
      { id: 'a1', reference: 'C-1', prestataireNom: 'Acme', identifiant: null, tierId: 't1' },
      { id: 'a2', reference: 'C-2', prestataireNom: 'SEUL TIC SA', identifiant: null, tierId: 't2' },
      { id: 'a3', reference: 'C-3', prestataireNom: 'Acme Logiciels', identifiant: '549300abcdefghij1234', tierId: null },
    ])
    m.ppFindMany.mockResolvedValue([{ tierId: 't1', analyseId: 'an1' }, { tierId: 't3', analyseId: 'an2' }, { tierId: 't3', analyseId: 'an2' }])
    const res = await GET(req('/api/tier-registry'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const cover = Object.fromEntries(body.tiers.map((t: { id: string; coverage: string }) => [t.id, t.coverage]))
    expect(cover).toEqual({ t1: 'CYBER_AND_TIC', t2: 'TIC_ONLY', t3: 'CYBER_ONLY' })
    expect(body.tiers.find((t: { id: string }) => t.id === 't3').analysesCount).toBe(1)
    expect(body.unlinkedArrangements).toHaveLength(1)
    expect(body.unlinkedArrangements[0]).toMatchObject({ id: 'a3', candidates: [{ tierId: 't1', reason: 'LEI', strength: 'STRONG', nom: 'Acme' }] })
    expect(m.arrFindMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'fil1' })
  })
  it('module réglementaire inactif : aucun arrangement lu ; sans organisation : inactif ; non connecté : 401', async () => {
    m.cfg.mockResolvedValue({ reglementaireActive: false })
    await GET(req('/api/tier-registry')); expect(m.arrFindMany).not.toHaveBeenCalled()
    m.scope.mockResolvedValue({ role: 'ADMIN', activeOrgId: null, scope: { visibleOrgIds: [], isSuperAdmin: false } })
    expect((await (await GET(req('/api/tier-registry'))).json()).active).toBe(false)
    m.session.mockResolvedValue(null); expect((await GET(req('/api/tier-registry'))).status).toBe(401)
  })
})

describe('GET /api/tier-registry — propositions de contrats groupe', () => {
  it('liste les contrats groupe PROPOSÉS pour l’organisation active (référence, prestataire, organisation porteuse), sans rien accorder', async () => {
    m.benFindMany.mockResolvedValue([{ arrangementId: 'aG', arrangement: { reference: 'CG-7', prestataireNom: 'Hébergeur Groupe', organization: { nom: 'Holding' } } }])
    const body = await (await GET(req('/api/tier-registry'))).json()
    expect(body.proposals).toEqual([{ arrangementId: 'aG', reference: 'CG-7', prestataireNom: 'Hébergeur Groupe', ownerNom: 'Holding' }])
    expect(m.benFindMany.mock.calls[0][0].where).toEqual({ organizationId: 'fil1', status: 'PROPOSED' })
    expect(body.isAdmin).toBe(true)
    expect(m.tierOrgCreate).not.toHaveBeenCalled()
  })
})

describe('POST /api/tier-registry — création d’une identité', () => {
  it('crée le tiers à la racine du groupe, accorde l’accès à l’organisation active et rattache les arrangements choisis', async () => {
    const res = await POST(req('/api/tier-registry', { nom: 'Nouveau Prestataire', lei: '549300abcdefghij1234', pays: 'fr', linkArrangementIds: ['a1'] }))
    expect(res.status).toBe(201)
    expect(m.tierCreate.mock.calls[0][0].data).toMatchObject({ rootOrganizationId: 'grp', nom: 'Nouveau Prestataire', lei: '549300ABCDEFGHIJ1234', pays: 'FR' })
    expect(m.tierOrgCreate.mock.calls[0][0].data).toEqual({ tierId: 'tNew', organizationId: 'fil1' })
    expect(m.arrUpdateMany.mock.calls[0][0]).toMatchObject({ where: { id: { in: ['a1'] }, organizationId: 'fil1', tierId: null }, data: { tierId: 'tNew' } })
    expect(m.audit).toHaveBeenCalled()
  })
  it('candidat existant : 409 avec les candidats ; créé quand même seulement avec confirmNew', async () => {
    m.tierOrgFindMany.mockResolvedValue([{ tier: { id: 't1', nom: 'Acme', lei: null, pays: null, aliases: [] } }])
    const res = await POST(req('/api/tier-registry', { nom: 'ACME SAS' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'possible_duplicate', candidates: [{ tierId: 't1', nom: 'Acme', reason: 'NAME' }] })
    expect(m.tierCreate).not.toHaveBeenCalled()
    expect((await POST(req('/api/tier-registry', { nom: 'ACME SAS', confirmNew: true }))).status).toBe(201)
  })
  it('LEI déjà connu dans le groupe mais non autorisé pour cette organisation : 409 sans rien révéler', async () => {
    m.tierFindFirst.mockResolvedValue({ id: 'tAutre' })
    const res = await POST(req('/api/tier-registry', { nom: 'Acme', lei: '549300ABCDEFGHIJ1234', confirmNew: true }))
    expect(res.status).toBe(409)
    const body = await res.json(); expect(body).toEqual({ error: 'tier_exists_in_group' })
    expect(m.tierCreate).not.toHaveBeenCalled()
  })
  it('validation, droits, limite de débit', async () => {
    expect((await POST(req('/api/tier-registry', { nom: '' }))).status).toBe(400)
    expect((await POST(req('/api/tier-registry', { nom: 'A', lei: 'mal formé' }))).status).toBe(400)
    m.scope.mockResolvedValue(scope('ANALYSTE')); expect((await POST(req('/api/tier-registry', { nom: 'A' }))).status).toBe(403)
    m.scope.mockResolvedValue(scope('ADMIN')); m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 1 })
    expect((await POST(req('/api/tier-registry', { nom: 'A' }))).status).toBe(429)
  })
})

describe('POST /api/tier-registry/link — rattacher ou détacher un arrangement', () => {
  beforeEach(() => { m.arrFindFirst.mockResolvedValue({ id: 'a3', tierId: null }); m.tierOrgFindUnique.mockResolvedValue({ tierId: 't1' }); m.arrUpdate.mockResolvedValue({}) })
  it('rattache à un tiers autorisé pour l’organisation (journalisé)', async () => {
    const res = await LINK(req('/api/tier-registry/link', { arrangementId: 'a3', tierId: 't1' }))
    expect(res.status).toBe(200)
    expect(m.arrFindFirst.mock.calls[0][0].where).toEqual({ id: 'a3', organizationId: 'fil1' })
    expect(m.arrUpdate.mock.calls[0][0]).toMatchObject({ where: { id: 'a3' }, data: { tierId: 't1' } })
    expect(m.audit).toHaveBeenCalled()
  })
  it('tiers non autorisé pour l’organisation : 404 ; arrangement d’une autre organisation : 404 ; détacher (tierId nul) : permis', async () => {
    m.tierOrgFindUnique.mockResolvedValue(null)
    expect((await LINK(req('/api/tier-registry/link', { arrangementId: 'a3', tierId: 'tEtranger' }))).status).toBe(404)
    m.tierOrgFindUnique.mockResolvedValue({ tierId: 't1' }); m.arrFindFirst.mockResolvedValue(null)
    expect((await LINK(req('/api/tier-registry/link', { arrangementId: 'aAutreOrg', tierId: 't1' }))).status).toBe(404)
    m.arrFindFirst.mockResolvedValue({ id: 'a3', tierId: 't1' })
    expect((await LINK(req('/api/tier-registry/link', { arrangementId: 'a3', tierId: null }))).status).toBe(200)
    expect(m.arrUpdate.mock.calls.at(-1)![0].data).toEqual({ tierId: null })
  })
  it('droits : un simple analyste ne peut pas rattacher', async () => {
    m.scope.mockResolvedValue(scope('ANALYSTE'))
    expect((await LINK(req('/api/tier-registry/link', { arrangementId: 'a3', tierId: 't1' }))).status).toBe(403)
  })
  it('lot T2 — tête de groupe : pire niveau et concentration de l’organisation, détail par filiale visible', async () => {
    m.scope.mockResolvedValue({ role: 'RSSI', activeOrgId: 'grp', scope: { visibleOrgIds: ['grp', 'fil1'], isSuperAdmin: false } })
    m.orgFindUnique.mockResolvedValue({ path: '/grp/' })
    m.orgFindMany.mockResolvedValue([{ id: 'grp', nom: 'Groupe' }, { id: 'fil1', nom: 'Filiale 1' }, { id: 'fil2', nom: 'Filiale invisible' }])
    m.tierOrgFindMany.mockResolvedValue([{ tier: { id: 't1', nom: 'Hébergeur', lei: null, pays: 'FR', aliases: [] } }])
    m.usageFindMany.mockResolvedValue([
      { organizationId: 'grp', criticite: 'CRITIQUE', processus: { id: 'p1', criticite: 4, criticiteDora: null }, evaluation: { actuelle: { dependance: 2, penetration: 2, maturite: 2, confiance: 2 } }, tierService: { tierId: 't1' } },
      { organizationId: 'fil1', criticite: null, processus: null, evaluation: { actuelle: { dependance: 4, penetration: 3, maturite: 2, confiance: 2 } }, tierService: { tierId: 't1' } },
    ])
    const j = await (await GET(req('/api/tier-registry'))).json()
    const ev = j.tiers[0].evaluation
    expect(ev.pire).toEqual({ menace: 1, zone: 'veille', evalues: 1 })
    expect(ev.concentration).toEqual({ usagesCritiques: 1, processusCritiques: 1 })
    expect(ev.groupe.pire).toMatchObject({ menace: 3, zone: 'danger' })
    expect(ev.groupe.parOrganisation.map((o: { organisation: string }) => o.organisation)).toEqual(['Groupe', 'Filiale 1'])
    // Usages cherchés dans les seules organisations visibles du sous-arbre (jamais une filiale hors périmètre).
    expect(m.usageFindMany.mock.calls[0][0].where.organizationId).toEqual({ in: ['grp', 'fil1'] })
  })
})
