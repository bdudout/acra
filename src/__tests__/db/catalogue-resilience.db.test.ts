/**
 * Catalogue 1.6 : un plan de test de résilience modèle crée un test PLANIFIÉ sur une vraie base,
 * idempotent (index unique organisation + clé de catalogue), y compris en import concurrent.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { POST } from '@/app/api/catalogue-suggestions/route'

const post = (body: unknown) => POST(new Request('http://test.local/api/catalogue-suggestions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never)
const selection = { sector: 'FINANCE', locale: 'fr', selectedKeys: ['core.process.digital', 'core.resilience.pentest', 'finance.process.payments', 'finance.resilience.payment-end-to-end'], acceptUnlinked: true }

let org: { id: string }
beforeAll(async () => {
  org = await makeOrg('Résilience')
  await prisma.organizationConfig.create({ data: { id: org.id, registreRisquesActive: true, reglementaireActive: true } })
  const admin = await makeUser('ANALYSTE', [{ id: org.id, role: 'ADMIN' }])
  session.user = { id: admin.id, role: 'ANALYSTE' }
  session.activeOrg = org.id
})
afterAll(async () => { await prisma.$disconnect() })

describe('catalogue — plans de test de résilience (vraie base)', () => {
  it('crée des tests PLANIFIÉS de l’année, sans date, résultat, constat ni présomption, puis n’en recrée aucun', async () => {
    const res = await post(selection)
    expect(res.status).toBe(201)
    const tests = await prisma.testResilience.findMany({ where: { organizationId: org.id }, orderBy: { catalogueKey: 'asc' } })
    expect(tests.map(t => [t.catalogueKey, t.type])).toEqual([['core.resilience.pentest', 'PENETRATION'], ['finance.resilience.payment-end-to-end', 'END_TO_END']])
    for (const t of tests) {
      expect(t).toMatchObject({ statut: 'PLANIFIE', annee: new Date().getFullYear(), fonctionCritique: false, independant: false, datePrevue: null, dateRealisation: null, resultat: null, constats: [] })
      expect(t.processusId).not.toBeNull()
    }
    const again = await post(selection)
    expect(again.status).toBe(200)
    expect(await prisma.testResilience.count({ where: { organizationId: org.id } })).toBe(2)
  })

  it('deux imports simultanés du même modèle ne créent qu’un test', async () => {
    const body = { sector: null, locale: 'fr', selectedKeys: ['core.resilience.source-code'], acceptUnlinked: true }
    const statuses = (await Promise.all([post(body), post(body)])).map(r => r.status).sort()
    expect(statuses).toEqual([200, 201])
    expect(await prisma.testResilience.count({ where: { organizationId: org.id, catalogueKey: 'core.resilience.source-code' } })).toBe(1)
  })
})
