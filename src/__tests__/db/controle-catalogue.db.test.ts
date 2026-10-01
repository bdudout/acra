/** Catalogue unifié des contrôles : trois portes d'entrée, un seul import par modèle, liens réels (vraie base). */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { GET, POST } from '@/app/api/controles/catalogue/route'

const post = (body: unknown) => POST(new Request('http://test.local/api/controles/catalogue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never)
const get = () => GET(new Request('http://test.local/api/controles/catalogue?locale=fr') as never)

let org: { id: string }, riskId: string, processId: string
beforeAll(async () => {
  org = await makeOrg('Contrôles')
  await prisma.organization.update({ where: { id: org.id }, data: { secteursActivite: ['FINANCE'] } })
  await prisma.organizationConfig.create({ data: { id: org.id, controlePermanentActive: true, secondeLigneActive: true } })
  const admin = await makeUser('ANALYSTE', [{ id: org.id, role: 'ADMIN' }])
  session.user = { id: admin.id, role: 'ANALYSTE' }; session.activeOrg = org.id
  processId = (await prisma.processus.create({ data: { organizationId: org.id, nom: 'Paiements', catalogueKey: 'finance.process.payments' } })).id
  riskId = (await prisma.riskItem.create({ data: { organizationId: org.id, intitule: 'Rapprochement', catalogueKey: 'finance.risk.reconciliation' } })).id
})
afterAll(async () => { await prisma.$disconnect() })

describe('catalogue unifié des contrôles (vraie base)', () => {
  it('par référentiel : le contrôle garde son référentiel et ses exigences', async () => {
    expect((await post({ keys: ['ref.iso27001.1'] })).status).toBe(201)
    const c = await prisma.controle.findFirstOrThrow({ where: { organizationId: org.id, catalogueKey: 'ref.iso27001.1' } })
    expect(c.referentielCode).toBe('ISO27001')
    expect((c.exigenceRefs as string[]).length).toBeGreaterThan(0)
    expect(c.responsable).toBeNull()
  })

  it('par risque / processus : rattaché au risque et au processus que l’organisation possède déjà', async () => {
    expect((await post({ keys: ['finance.control.reconciliation'] })).status).toBe(201)
    const c = await prisma.controle.findFirstOrThrow({ where: { organizationId: org.id, catalogueKey: 'finance.control.reconciliation' } })
    expect(c).toMatchObject({ riskItemId: riskId, processusId: processId, typeControle: 'DETECTIF' })
  })

  it('un même modèle n’est jamais importé deux fois, quelle que soit l’entrée ; un intitulé existant est signalé', async () => {
    expect((await post({ keys: ['finance.control.reconciliation'] })).status).toBe(200)
    expect(await prisma.controle.count({ where: { organizationId: org.id, catalogueKey: 'finance.control.reconciliation' } })).toBe(1)
    await prisma.controle.create({ data: { organizationId: org.id, intitule: 'Revue des comptes à privilèges' } })
    const data = await (await get()).json() as { templates: { key: string; status: string }[]; ownedRiskKeys: string[] }
    const status = Object.fromEntries(data.templates.map(t => [t.key, t.status]))
    expect(status['finance.control.reconciliation']).toBe('ALREADY_IMPORTED')
    expect(status['core.control.privileged-review']).toBe('SIMILAR')
    expect(data.ownedRiskKeys).toContain('finance.risk.reconciliation')
    expect((await post({ keys: ['inconnu.control.x'] })).status).toBe(400)
  })
})
