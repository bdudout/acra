// @vitest-environment node
// Import vers le référentiel des entités (lot E2) : aperçu des écarts sans écriture, application des choix
// (créations, renommages, clôtures) en transaction, connecteur = liste complète, droits.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  session: vi.fn(), scope: vi.fn(), rl: vi.fn(), audit: vi.fn(), orgFind: vi.fn(), cfgFind: vi.fn(),
  findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), tx: vi.fn(), queryRaw: vi.fn(), lire: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_EXCEL_PARSE: { limit: 30, windowMs: 1 }, LIMIT_API_WRITE: { limit: 30, windowMs: 1 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/entity-sync.server', async () => ({ ...(await vi.importActual<object>('@/lib/entity-sync.server')), lireConnecteur: m.lire }))
vi.mock('@/lib/prisma', () => ({ prisma: { organization: { findUnique: m.orgFind }, organizationConfig: { findUnique: m.cfgFind }, entite: { findMany: m.findMany, create: m.create, update: m.update, updateMany: m.updateMany }, $transaction: m.tx } }))
import { POST } from '@/app/api/referentiel-entites/import/route'

const csv = (text: string) => ({ origine: 'FICHIER', filename: 'entites.csv', data: Buffer.from(text, 'utf8').toString('base64') })
const req = (body: object) => new NextRequest('http://x/api/referentiel-entites/import', { method: 'POST', body: JSON.stringify(body) })
const EXIST = [
  { id: 'dsi', nom: 'Direction SI', type: 'SERVICE', alias: [], codeExterne: 'D100', parentId: null, source: 'IMPORT', valideAu: null },
  { id: 'lyon', nom: 'Site Lyon', type: 'SITE', alias: [], codeExterne: 'S9', parentId: null, source: 'IMPORT', valideAu: null },
]
const FILE = 'Code;Nom;Type;Parent;Alias\nG1;Groupe;Filiale;;\nD100;Direction des systèmes d’information;Service;G1;DSI\nA1;Achats;;G1;\n;;;;\n'

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
  m.rl.mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 })
  m.orgFind.mockResolvedValue({ path: '/o1/' })
  m.cfgFind.mockResolvedValue({ entitesSyncConfig: { type: 'REST', endpoint: 'https://d.example.test' } })
  m.findMany.mockResolvedValue(EXIST)
  m.queryRaw.mockResolvedValue([])
  m.create.mockImplementation(async ({ data }: { data: { nom: string } }) => ({ id: `id-${data.nom}`, ...data }))
  m.tx.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ $queryRaw: m.queryRaw, entite: { findMany: m.findMany, create: m.create, update: m.update, updateMany: m.updateMany } }))
})

describe('POST /api/referentiel-entites/import', () => {
  it('aperçu : colonnes reconnues, écarts expliqués, rien n’est écrit', async () => {
    const r = await POST(req({ ...csv(FILE), dryRun: true, typeParDefaut: 'DIRECTION', listeComplete: true }))
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.colonnes).toMatchObject({ code: 'Code', nom: 'Nom', type: 'Type', parent: 'Parent', alias: 'Alias' })
    expect(Object.fromEntries(j.lignes.map((l: { line: number; statut: string }) => [l.line, l.statut]))).toEqual({ 2: 'NOUVELLE', 3: 'RENOMMEE', 4: 'NOUVELLE' })
    expect(j.disparues).toEqual([{ id: 'lyon', nom: 'Site Lyon' }])
    expect(m.create).not.toHaveBeenCalled()
    expect(m.update).not.toHaveBeenCalled()
  })

  it('application : parents créés avant enfants (source IMPORT), renommage retenu, clôture choisie', async () => {
    const r = await POST(req({ ...csv(FILE), typeParDefaut: 'DIRECTION', listeComplete: true, clore: ['lyon'] }))
    expect(r.status).toBe(201)
    expect(m.queryRaw).toHaveBeenCalled() // verrou par organisation
    const crees = m.create.mock.calls.map(c => c[0].data)
    expect(crees.map(d => d.nom)).toEqual(['Groupe', 'Achats'])
    expect(crees[0]).toMatchObject({ organizationId: 'o1', type: 'FILIALE', codeExterne: 'G1', source: 'IMPORT' })
    expect(crees[1]).toMatchObject({ parentId: 'id-Groupe', type: 'DIRECTION' })
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'dsi' }, data: { nom: 'Direction des systèmes d’information' } })
    expect(m.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['lyon'] }, organizationId: 'o1' }, data: { valideAu: expect.any(Date) } })
    expect(m.audit).toHaveBeenCalledWith('ENTITE_REFERENTIEL_UPDATED', expect.objectContaining({ details: expect.objectContaining({ action: 'import', crees: 2, renommees: 1, closes: 1 }) }))
  })

  it('connecteur : noms lus dans l’annuaire, liste complète, source ANNUAIRE', async () => {
    m.lire.mockResolvedValue(['Direction SI', 'Juridique'])
    const apercu = await (await POST(req({ origine: 'CONNECTEUR', dryRun: true, typeParDefaut: 'SERVICE' }))).json()
    expect(apercu.lignes.map((l: { statut: string }) => l.statut)).toEqual(['INCHANGEE', 'NOUVELLE'])
    expect(apercu.disparues).toEqual([{ id: 'lyon', nom: 'Site Lyon' }])
    await POST(req({ origine: 'CONNECTEUR', typeParDefaut: 'SERVICE' }))
    expect(m.create.mock.calls[0][0].data).toMatchObject({ nom: 'Juridique', type: 'SERVICE', source: 'ANNUAIRE' })
  })

  it('connecteur injoignable → 422 ; non configuré → 400', async () => {
    m.lire.mockRejectedValue(new Error('x'))
    expect((await POST(req({ origine: 'CONNECTEUR', dryRun: true, typeParDefaut: 'SERVICE' }))).status).toBe(422)
    m.cfgFind.mockResolvedValue(null)
    expect((await POST(req({ origine: 'CONNECTEUR', dryRun: true, typeParDefaut: 'SERVICE' }))).status).toBe(400)
  })

  it('droits et contrôles : non-ADMIN 403, colonne « nom » absente 400, débit 429', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await POST(req({ ...csv(FILE), dryRun: true, typeParDefaut: 'DIRECTION' }))).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
    const r = await POST(req({ ...csv('Machin;Truc\na;b\n'), dryRun: true, typeParDefaut: 'DIRECTION' }))
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('name_column_missing')
    m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 })
    expect((await POST(req({ ...csv(FILE), dryRun: true, typeParDefaut: 'DIRECTION' }))).status).toBe(429)
  })
})
