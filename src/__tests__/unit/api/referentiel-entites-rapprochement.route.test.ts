// @vitest-environment node
// Rapprochement des textes libres (lot E3) : valeurs distinctes non encore liées, bornées à l'organisation active ;
// application ADMIN en transaction (liens sur les 6 objets, alias ajoutés, créations), texte d'origine conservé.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const MODELES = ['riskItem', 'incident', 'conformite', 'planAction', 'conformiteTraitement', 'mesure'] as const
const m = vi.hoisted(() => {
  const noms = ['riskItem', 'incident', 'conformite', 'planAction', 'conformiteTraitement', 'mesure']
  return {
    session: vi.fn(), scope: vi.fn(), rl: vi.fn(), audit: vi.fn(), orgFind: vi.fn(), cfgFind: vi.fn(),
    entFindMany: vi.fn(), entCreate: vi.fn(), entUpdate: vi.fn(), tx: vi.fn(), queryRaw: vi.fn(),
    groupBy: Object.fromEntries(noms.map(k => [k, vi.fn()])), updateMany: Object.fromEntries(noms.map(k => [k, vi.fn()])),
  }
})
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, LIMIT_API_WRITE: { limit: 9, windowMs: 1 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/prisma', () => {
  const modeles = Object.fromEntries(['riskItem', 'incident', 'conformite', 'planAction', 'conformiteTraitement', 'mesure'].map(k => [k, { groupBy: m.groupBy[k], updateMany: m.updateMany[k] }]))
  const entite = { findMany: m.entFindMany, create: m.entCreate, update: m.entUpdate }
  return { prisma: { organization: { findUnique: m.orgFind }, organizationConfig: { findUnique: m.cfgFind }, entite, ...modeles, $transaction: m.tx } }
})
import { GET, POST } from '@/app/api/referentiel-entites/rapprochement/route'

const req = (body: object) => new NextRequest('http://x/api/referentiel-entites/rapprochement', { method: 'POST', body: JSON.stringify(body) })
const DSI = { id: 'dsi', nom: 'Direction des systèmes d’information', type: 'SERVICE', alias: ['DSI'], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null }

beforeEach(async () => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
  m.rl.mockResolvedValue({ allowed: true })
  m.orgFind.mockResolvedValue({ path: '/o1/' })
  m.cfgFind.mockResolvedValue(null)
  m.entFindMany.mockResolvedValue([DSI])
  m.entCreate.mockImplementation(async ({ data }: { data: { nom: string } }) => ({ id: `id-${data.nom}`, ...data }))
  for (const k of MODELES) { m.groupBy[k].mockResolvedValue([]); m.updateMany[k].mockResolvedValue({ count: 1 }) }
  m.groupBy.riskItem.mockResolvedValue([{ entite: 'DSI', _count: { _all: 3 } }, { entite: 'Direction SI', _count: { _all: 1 } }])
  m.groupBy.mesure.mockResolvedValue([{ entite: 'Juridique', _count: { _all: 2 } }])
  m.groupBy.conformite.mockResolvedValue([{ entite: '', _count: { _all: 4 } }])
  const { prisma } = await import('@/lib/prisma')
  m.tx.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ ...prisma, $queryRaw: m.queryRaw }))
})

describe('GET rapprochement', () => {
  it('valeurs non liées de l’organisation active, avec proposition ; mesures bornées par l’analyse', async () => {
    const r = await GET()
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(m.groupBy.riskItem.mock.calls[0][0].where).toEqual({ organizationId: 'o1', entiteId: null, entite: { not: null } })
    expect(m.groupBy.mesure.mock.calls[0][0].where).toEqual({ analyse: { organizationId: 'o1' }, entiteId: null, entite: { not: null } })
    expect(j.propositions.map((p: { valeur: string; niveau: string }) => [p.valeur, p.niveau])).toEqual([['DSI', 'EXACTE'], ['Juridique', 'AUCUNE'], ['Direction SI', 'AUCUNE']])
  })
  it('non-ADMIN → 403', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await GET()).status).toBe(403)
  })
})

describe('POST rapprochement', () => {
  it('lie les objets non encore liés (texte conservé), ajoute la variante en alias, crée une entité', async () => {
    const r = await POST(req({ decisions: [{ valeur: 'Direction SI', entiteId: 'dsi' }, { valeur: 'Juridique', creer: 'SERVICE' }] }))
    expect(r.status).toBe(200)
    expect(m.queryRaw).toHaveBeenCalled()
    expect(m.updateMany.riskItem).toHaveBeenCalledWith({ where: { organizationId: 'o1', entiteId: null, entite: { in: ['Direction SI'] } }, data: { entiteId: 'dsi' } })
    expect(m.updateMany.mesure).toHaveBeenCalledWith({ where: { analyse: { organizationId: 'o1' }, entiteId: null, entite: { in: ['Juridique'] } }, data: { entiteId: 'id-Juridique' } })
    expect(m.entUpdate).toHaveBeenCalledWith({ where: { id: 'dsi' }, data: { alias: ['DSI', 'Direction SI'] } })
    expect(m.entCreate.mock.calls[0][0].data).toMatchObject({ organizationId: 'o1', nom: 'Juridique', type: 'SERVICE', source: 'MANUEL' })
    expect(m.audit).toHaveBeenCalledWith('ENTITE_REFERENTIEL_UPDATED', expect.objectContaining({ details: expect.objectContaining({ action: 'rapprochement', liens: 2, creees: 1 }) }))
  })
  it('valeur inconnue ou entité hors référentiel → 400, rien n’est écrit', async () => {
    const r = await POST(req({ decisions: [{ valeur: 'DSI', entiteId: 'autre-org' }] }))
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('entite_invalide')
    for (const k of MODELES) expect(m.updateMany[k]).not.toHaveBeenCalled()
  })
})
