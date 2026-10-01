/** Traitements types RoPA : import ligne par ligne, idempotent et sûr en concurrence, sur une vraie base. */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { GET, POST } from '@/app/api/ropa/catalogue/route'

const post = (body: unknown) => POST(new Request('http://test.local/api/ropa/catalogue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never)
const get = (locale = 'fr') => GET(new Request(`http://test.local/api/ropa/catalogue?locale=${locale}`) as never)

let org: { id: string }
beforeAll(async () => {
  org = await makeOrg('RoPA')
  const admin = await makeUser('ANALYSTE', [{ id: org.id, role: 'ADMIN' }])
  session.user = { id: admin.id, role: 'ANALYSTE' }; session.activeOrg = org.id
})
afterAll(async () => { await prisma.$disconnect() })

describe('catalogue RoPA (vraie base)', () => {
  it('importe seulement les lignes choisies, dans la langue choisie, avec leur provenance', async () => {
    const res = await post({ keys: ['ropa.payroll', 'ropa.cctv'], locale: 'en' })
    expect(res.status).toBe(201)
    const rows = await prisma.traitement.findMany({ where: { organizationId: org.id }, orderBy: { catalogueKey: 'asc' } })
    expect(rows.map(r => [r.catalogueKey, r.nom])).toEqual([['ropa.cctv', 'Video surveillance'], ['ropa.payroll', 'Payroll']])
    expect(rows.find(r => r.catalogueKey === 'ropa.cctv')!.surveillanceSystematique).toBe(true)
  })

  it('l’aperçu signale ce qui est déjà importé et un nom déjà présent, sans fusion', async () => {
    await prisma.traitement.create({ data: { organizationId: org.id, nom: 'Recrutement', finalite: 'Saisie manuelle' } })
    const { items } = await (await get()).json() as { items: { key: string; status: string }[] }
    const status = Object.fromEntries(items.map(i => [i.key, i.status]))
    expect(status['ropa.payroll']).toBe('ALREADY_IMPORTED')
    expect(status['ropa.recruitment']).toBe('SIMILAR')
    expect(status['ropa.accounting']).toBe('NEW')
  })

  it('deux imports simultanés de la même ligne n’en créent qu’une ; clé inconnue refusée', async () => {
    const statuses = (await Promise.all([post({ keys: ['ropa.accounting'] }), post({ keys: ['ropa.accounting'] })])).map(r => r.status).sort()
    expect(statuses).toEqual([200, 201])
    expect(await prisma.traitement.count({ where: { organizationId: org.id, catalogueKey: 'ropa.accounting' } })).toBe(1)
    expect((await post({ keys: ['ropa.inconnu'] })).status).toBe(400)
  })
})
