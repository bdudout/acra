// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), cfg: vi.fn(), rl: vi.fn(), arrFind: vi.fn(), arrCreate: vi.fn(), tierFind: vi.fn(), tx: vi.fn(), queryRaw: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.cfg }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_EXCEL_PARSE: { limit: 30, windowMs: 600_000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/prisma', () => ({ prisma: { arrangementTic: { findMany: m.arrFind, create: m.arrCreate }, tierOrganization: { findMany: m.tierFind }, $transaction: m.tx } }))
import { POST } from '@/app/api/reglementaire/registre-tic/import/route'

const csv = (text: string) => ({ filename: 'contrats.csv', data: Buffer.from(text, 'utf8').toString('base64') })
const req = (body: object) => new NextRequest('http://x/api/reglementaire/registre-tic/import', { method: 'POST', body: JSON.stringify(body) })
const FILE = 'Référence;Prestataire;LEI;Type de service;Criticité\nC-1;Acme SAS;549300ABCDEFGHIJ1234;CLOUD;critique\nC-2;Beta Cloud;;;\nC-3;Gamma;;LICORNE;\nC-4;Déjà;;;\n'

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'RSSI' })
  m.cfg.mockResolvedValue({ reglementaireActive: true })
  m.rl.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 })
  m.arrFind.mockResolvedValue([{ reference: 'C-4' }])
  m.tierFind.mockResolvedValue([{ tier: { id: 't1', nom: 'Acme', lei: '549300ABCDEFGHIJ1234', aliases: [] } }, { tier: { id: 't2', nom: 'Beta Cloud', lei: null, aliases: [] } }])
  m.queryRaw.mockResolvedValue([])
  m.arrCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 'new', ...data }))
  m.tx.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ $queryRaw: m.queryRaw, arrangementTic: { findMany: m.arrFind, create: m.arrCreate }, tierOrganization: { findMany: m.tierFind } }))
})

describe('POST /api/reglementaire/registre-tic/import', () => {
  it('aperçu : explique chaque ligne, propose les identités (LEI = certain, nom = faible), n’écrit rien', async () => {
    const res = await POST(req({ ...csv(FILE), dryRun: true }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const by = Object.fromEntries(body.lines.map((l: { line: number; status: string; reason?: string; tier?: { strength: string } }) => [l.line, [l.status, l.reason, l.tier?.strength].filter(Boolean).join(':')]))
    expect(by).toEqual({ 2: 'READY:STRONG', 3: 'READY:WEAK', 4: 'REJECTED:invalid_type', 5: 'ALREADY_IMPORTED' })
    expect(body.counts).toEqual({ ready: 2, alreadyImported: 1, rejected: 1, certainLinks: 1 })
    expect(m.arrCreate).not.toHaveBeenCalled()
  })
  it('import : crée les lignes prêtes (verrou, audit) ; sans demande explicite aucun tiers n’est lié', async () => {
    const res = await POST(req(csv(FILE)))
    expect(res.status).toBe(201)
    expect(m.queryRaw).toHaveBeenCalled(); expect(m.audit).toHaveBeenCalled()
    expect(m.arrCreate).toHaveBeenCalledTimes(2)
    expect(m.arrCreate.mock.calls.every(c => !('tierId' in c[0].data))).toBe(true)
    expect(m.arrCreate.mock.calls[0][0].data).toMatchObject({ organizationId: 'org1', reference: 'C-1', prestataireNom: 'Acme SAS', identifiant: '549300ABCDEFGHIJ1234', typeService: 'CLOUD', criticite: 'CRITIQUE' })
    expect(m.arrCreate.mock.calls[1][0].data).toMatchObject({ reference: 'C-2', criticite: 'NON_CRITIQUE', typeService: 'AUTRE' })
  })
  it('linkCertain : lie uniquement sur LEI identique, jamais sur le nom seul', async () => {
    const res = await POST(req({ ...csv(FILE), linkCertain: true }))
    expect((await res.json()).linked).toBe(1)
    expect(m.arrCreate.mock.calls[0][0].data.tierId).toBe('t1')
    expect(m.arrCreate.mock.calls[1][0].data).not.toHaveProperty('tierId')
  })
  it('colonnes introuvables : 400 avec les en-têtes ; droits, module, organisation, débit', async () => {
    const r = await POST(req({ ...csv('Machin;Truc\na;b\n'), dryRun: true }))
    expect(r.status).toBe(400); expect(await r.json()).toMatchObject({ error: 'tic_columns_missing', headers: ['Machin', 'Truc'] })
    m.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'LECTEUR' })
    expect((await POST(req({ ...csv(FILE), dryRun: true }))).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'RSSI' }); m.cfg.mockResolvedValue({ reglementaireActive: false })
    expect((await POST(req({ ...csv(FILE), dryRun: true }))).status).toBe(403)
    m.cfg.mockResolvedValue({ reglementaireActive: true }); m.scope.mockResolvedValue({ activeOrgId: null, role: 'RSSI' })
    expect((await POST(req({ ...csv(FILE), dryRun: true }))).status).toBe(400)
    m.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'RSSI' }); m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 1 })
    expect((await POST(req({ ...csv(FILE), dryRun: true }))).status).toBe(429)
  })
})
