// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), cfg: vi.fn(), rl: vi.fn(), findMany: vi.fn(), create: vi.fn(), tx: vi.fn(), queryRaw: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.cfg }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_EXCEL_PARSE: { limit: 30, windowMs: 600_000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/prisma', () => ({ prisma: { processus: { findMany: m.findMany, create: m.create }, $transaction: m.tx } }))
import { POST } from '@/app/api/processus/import/route'

const csv = (text: string, filename = 'processus.csv') => ({ filename, data: Buffer.from(text, 'utf8').toString('base64') })
const req = (body: object) => new NextRequest('http://x/api/processus/import', { method: 'POST', body: JSON.stringify(body) })
const FILE = 'Réf.;Parent;Nom;Description\nP1;;Achats;Toutes les commandes\nP1.1;P1;Commande;\nP2;P9;Orphelin;\n;;;\nP3;;;sans nom\n'

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
  m.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ADMIN' })
  m.cfg.mockResolvedValue({ registreRisquesActive: true })
  m.rl.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 })
  m.findMany.mockResolvedValue([])
  m.queryRaw.mockResolvedValue([])
  m.create.mockImplementation(async ({ data }: { data: { nom: string } }) => ({ id: `id-${data.nom}`, ...data }))
  m.tx.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ $queryRaw: m.queryRaw, processus: { findMany: m.findMany, create: m.create } }))
})

describe('POST /api/processus/import — aperçu', () => {
  it('lit le CSV, associe les colonnes et explique chaque ligne sans rien écrire', async () => {
    const res = await POST(req({ ...csv(FILE), dryRun: true }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.columns).toMatchObject({ ref: 'Réf.', parent: 'Parent', nom: 'Nom', description: 'Description' })
    const byLine = Object.fromEntries(body.lines.map((l: { line: number; status: string; reason?: string }) => [l.line, l.reason ? `${l.status}:${l.reason}` : l.status]))
    expect(byLine).toEqual({ 2: 'READY', 3: 'READY', 4: 'REJECTED:unknown_parent', 6: 'REJECTED:missing_name' })
    expect(m.create).not.toHaveBeenCalled()
  })
  it('colonne « nom » introuvable : 400 avec les en-têtes lus ; fichier .xls : message dédié ; trop de lignes : 413', async () => {
    const r1 = await POST(req({ ...csv('Machin;Truc\na;b\n'), dryRun: true }))
    expect(r1.status).toBe(400); expect((await r1.json())).toMatchObject({ error: 'name_column_missing', headers: ['Machin', 'Truc'] })
    const ole2 = Buffer.concat([Buffer.from('D0CF11E0A1B11AE1', 'hex'), Buffer.alloc(504)]).toString('base64')
    const r2 = await POST(req({ filename: 'a.xls', data: ole2, dryRun: true }))
    expect((await r2.json()).error).toBe('excel_xls_unsupported')
    const many = 'Nom\n' + Array.from({ length: 501 }, (_, i) => `P${i}`).join('\n')
    expect((await POST(req({ ...csv(many), dryRun: true }))).status).toBe(413)
  })
  it('droits : non-admin 403, module registre inactif 403, sans organisation 400, limite de débit 429', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ANALYSTE' })
    expect((await POST(req({ ...csv(FILE), dryRun: true }))).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ADMIN' }); m.cfg.mockResolvedValue({ registreRisquesActive: false })
    expect((await POST(req({ ...csv(FILE), dryRun: true }))).status).toBe(403)
    m.cfg.mockResolvedValue({ registreRisquesActive: true }); m.scope.mockResolvedValue({ activeOrgId: null, role: 'ADMIN' })
    expect((await POST(req({ ...csv(FILE), dryRun: true }))).status).toBe(400)
    m.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ADMIN' }); m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 1 })
    expect((await POST(req({ ...csv(FILE), dryRun: true }))).status).toBe(429)
  })
})

describe('POST /api/processus/import — import', () => {
  it('crée les lignes valides, parents avant enfants, avec provenance stable, dans une transaction verrouillée, et journalise', async () => {
    const res = await POST(req(csv(FILE)))
    expect(res.status).toBe(201)
    expect(m.queryRaw).toHaveBeenCalled() // verrou consultatif de l'organisation
    expect(m.create.mock.calls.map(c => [c[0].data.nom, c[0].data.catalogueKey, c[0].data.parentId])).toEqual([
      ['Achats', 'import:P1', null], ['Commande', 'import:P1.1', 'id-Achats'],
    ])
    const body = await res.json()
    expect(body.created).toBe(2); expect(body.counts.rejected).toBe(2)
    expect(m.audit).toHaveBeenCalled()
  })
  it('réimport : les lignes déjà importées ne sont pas recréées (idempotence par référence)', async () => {
    m.findMany.mockResolvedValue([{ id: 'db1', nom: 'Achats renommé', parentId: null, catalogueKey: 'import:P1' }, { id: 'db2', nom: 'Commande', parentId: 'db1', catalogueKey: 'import:P1.1' }])
    const res = await POST(req(csv(FILE)))
    expect(res.status).toBe(200); expect(m.create).not.toHaveBeenCalled()
    expect((await res.json()).created).toBe(0)
  })
  it('doublon possible : non créé sans confirmation, créé avec « createAnyway » (numéro de ligne)', async () => {
    m.findMany.mockResolvedValue([{ id: 'db1', nom: 'Achats', parentId: null, catalogueKey: null }])
    const plain = await POST(req(csv('Nom\nachats\n')))
    expect((await plain.json()).counts.possibleDuplicate).toBe(1); expect(m.create).not.toHaveBeenCalled()
    const forced = await POST(req({ ...csv('Nom\nachats\n'), createAnyway: [2] }))
    expect(forced.status).toBe(201); expect(m.create).toHaveBeenCalledTimes(1)
  })
})
