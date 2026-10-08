// @vitest-environment node
// Réorganisations (lot E4) : application ADMIN en transaction — créations, report des références sur les 6 objets avec
// la liste des objets déplacés, sous-entités rattachées au successeur, clôture à la date d'effet, événement historisé,
// purge au-delà de 5 ans ; lecture de l'historique par tout membre.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => {
  const noms = ['riskItem', 'incident', 'conformite', 'planAction', 'conformiteTraitement', 'mesure']
  return {
    session: vi.fn(), scope: vi.fn(), rl: vi.fn(), audit: vi.fn(), orgFind: vi.fn(), cfgFind: vi.fn(), tx: vi.fn(), queryRaw: vi.fn(),
    ent: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    evt: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    findMany: Object.fromEntries(noms.map(k => [k, vi.fn()])), updateMany: Object.fromEntries(noms.map(k => [k, vi.fn()])),
  }
})
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, LIMIT_API_WRITE: { limit: 9, windowMs: 1 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/prisma', () => {
  const modeles = Object.fromEntries(Object.keys(m.findMany).map(k => [k, { findMany: m.findMany[k], updateMany: m.updateMany[k] }]))
  return { prisma: { organization: { findUnique: m.orgFind }, organizationConfig: { findUnique: m.cfgFind }, entite: m.ent, entiteEvenement: m.evt, ...modeles, $transaction: m.tx } }
})
import { GET, POST } from '@/app/api/referentiel-entites/reorganisations/route'

const req = (body: object) => new NextRequest('http://x/api/referentiel-entites/reorganisations', { method: 'POST', body: JSON.stringify(body) })
const E = (id: string, nom: string, o = {}) => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })

beforeEach(async () => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
  m.rl.mockResolvedValue({ allowed: true })
  m.orgFind.mockResolvedValue({ path: '/o1/' })
  m.cfgFind.mockResolvedValue(null)
  m.ent.findMany.mockResolvedValue([E('a', 'Achats'), E('b', 'Appro'), E('a1', 'Achats IT', { parentId: 'a' })])
  m.ent.create.mockImplementation(async ({ data }: { data: { nom: string } }) => ({ id: `id-${data.nom}`, ...data }))
  m.evt.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'ev1', ...data }))
  m.evt.deleteMany.mockResolvedValue({ count: 0 })
  for (const k of Object.keys(m.findMany)) { m.findMany[k].mockResolvedValue([]); m.updateMany[k].mockResolvedValue({ count: 0 }) }
  m.findMany.riskItem.mockImplementation(async ({ where }: { where: { entiteId: string } }) => (where.entiteId === 'a' ? [{ id: 'r1' }, { id: 'r2' }] : []))
  m.findMany.mesure.mockImplementation(async ({ where }: { where: { entiteId: string } }) => (where.entiteId === 'b' ? [{ id: 'm1' }] : []))
  const { prisma } = await import('@/lib/prisma')
  m.tx.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ ...prisma, $queryRaw: m.queryRaw }))
})

describe('POST réorganisations', () => {
  it('fusion dans une nouvelle entité : création, références et sous-entités reportées, sources closes, événement', async () => {
    const r = await POST(req({ type: 'FUSION', dateEffet: '2026-10-01', sources: ['a', 'b'], cible: { nom: 'Achats et appro', type: 'DIRECTION' } }))
    expect(r.status).toBe(201)
    expect(m.queryRaw).toHaveBeenCalled()
    expect(m.ent.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'o1', nom: 'Achats et appro', alias: ['Achats', 'Appro'] })
    expect(m.updateMany.riskItem).toHaveBeenCalledWith({ where: { organizationId: 'o1', entiteId: 'a' }, data: { entiteId: 'id-Achats et appro' } })
    expect(m.updateMany.mesure).toHaveBeenCalledWith({ where: { analyse: { organizationId: 'o1' }, entiteId: 'b' }, data: { entiteId: 'id-Achats et appro' } })
    expect(m.ent.updateMany).toHaveBeenCalledWith({ where: { organizationId: 'o1', parentId: 'a', id: { not: 'id-Achats et appro' } }, data: { parentId: 'id-Achats et appro' } })
    expect(m.ent.updateMany).toHaveBeenCalledWith({ where: { organizationId: 'o1', id: { in: ['a', 'b'] } }, data: { valideAu: new Date('2026-10-01') } })
    const ev = m.evt.create.mock.calls[0][0].data
    expect(ev).toMatchObject({ organizationId: 'o1', type: 'FUSION', auteurId: 'u1', sources: [{ id: 'a', nom: 'Achats' }, { id: 'b', nom: 'Appro' }], cibles: [{ id: 'id-Achats et appro', nom: 'Achats et appro' }] })
    expect(ev.objets).toEqual({ a: { risques: ['r1', 'r2'] }, b: { mesures: ['m1'] } })
    expect(m.evt.deleteMany).toHaveBeenCalledWith({ where: { organizationId: 'o1', dateEffet: { lt: expect.any(Date) } } })
    expect(m.audit).toHaveBeenCalledWith('ENTITE_REFERENTIEL_UPDATED', expect.objectContaining({ details: expect.objectContaining({ action: 'reorganisation', type: 'FUSION', objets: 3 }) }))
  })

  it('renommage : nom changé, ancien nom en alias, rien de déplacé', async () => {
    const r = await POST(req({ type: 'RENOMMAGE', dateEffet: '2026-10-01', sources: ['a'], nouveauNom: 'Achats groupe' }))
    expect(r.status).toBe(201)
    expect(m.ent.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { nom: 'Achats groupe', alias: ['Achats'] } })
    for (const k of Object.keys(m.updateMany)) expect(m.updateMany[k]).not.toHaveBeenCalled()
    expect(m.evt.create.mock.calls[0][0].data).toMatchObject({ sources: [{ id: 'a', nom: 'Achats' }], cibles: [{ id: 'a', nom: 'Achats groupe' }] })
  })

  it('opération invalide → 400 sans écriture ; non-ADMIN → 403', async () => {
    const r = await POST(req({ type: 'FUSION', dateEffet: '2026-10-01', sources: ['a'], cible: { id: 'b' } }))
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('sources_insuffisantes')
    expect(m.evt.create).not.toHaveBeenCalled()
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await POST(req({ type: 'CLOTURE', dateEffet: '2026-10-01', sources: ['a'] }))).status).toBe(403)
  })
})

describe('GET historique', () => {
  it('tout membre lit l’historique de son organisation, du plus récent au plus ancien, dans la fenêtre de 5 ans', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'METIER' })
    m.evt.findMany.mockResolvedValue([{ id: 'ev1', type: 'FUSION', dateEffet: new Date('2026-10-01'), sources: [], cibles: [], objets: { a: { risques: ['r1', 'r2'] } }, auteurId: 'u1', createdAt: new Date() }])
    const r = await GET()
    expect(r.status).toBe(200)
    const arg = m.evt.findMany.mock.calls[0][0]
    expect(arg.where).toMatchObject({ organizationId: 'o1', dateEffet: { gte: expect.any(Date) } })
    expect(arg.orderBy).toEqual([{ dateEffet: 'desc' }, { createdAt: 'desc' }])
    expect((await r.json()).evenements[0]).toMatchObject({ id: 'ev1', nbObjets: 2 })
  })
})
