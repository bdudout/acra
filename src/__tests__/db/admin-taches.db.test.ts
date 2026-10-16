/**
 * Administration des tâches planifiées, sur base réelle : état des tâches et des échecs, relance
 * manuelle (exécution tracée MANUEL, journalisée), remise en file des webhooks en échec. Réservé au
 * super-administrateur.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }))

import { GET, POST } from '@/app/api/admin/taches/route'

afterAll(async () => { await prisma.$disconnect() })
let superAdmin: { id: string }, admin: { id: string }
beforeAll(async () => {
  process.env.CRON_SECRET = 'secret-de-test-relance'
  superAdmin = await makeUser('SUPER_ADMIN'); admin = await makeUser('ADMIN')
})
const post = (body: unknown) => POST(new NextRequest('http://test.local/api/admin/taches', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.6.0.1' } }))

describe('/api/admin/taches', () => {
  it('réservé au super-administrateur', async () => {
    session.user = { id: admin.id, role: 'ADMIN' }
    expect((await GET()).status).toBe(403)
    expect((await post({ action: 'relancer', tache: 'conformite-snapshots' })).status).toBe(403)
  })
  it('relance manuelle : la tâche s\'exécute, tracée MANUEL et journalisée', async () => {
    session.user = { id: superAdmin.id, role: 'SUPER_ADMIN' }
    const res = await post({ action: 'relancer', tache: 'conformite-snapshots' })
    expect(res.status, await res.clone().text()).toBe(200)
    const e = await prisma.executionTache.findFirstOrThrow({ where: { tache: 'conformite-snapshots' }, orderBy: { debut: 'desc' } })
    expect(e).toMatchObject({ declencheur: 'MANUEL', statut: 'OK' })
    expect(await prisma.auditLog.count({ where: { action: 'TACHE_PLANIFIEE_RELANCEE', userId: superAdmin.id } })).toBeGreaterThan(0)
  })
  it('tâche inconnue → 400', async () => {
    session.user = { id: superAdmin.id, role: 'SUPER_ADMIN' }
    expect((await post({ action: 'relancer', tache: '../../etc' })).status).toBe(400)
  })
  it('état : dernière exécution par tâche, échecs récents ; webhooks en échec remis en file', async () => {
    session.user = { id: superAdmin.id, role: 'SUPER_ADMIN' }
    await prisma.executionTache.create({ data: { tache: 'relances', statut: 'ECHEC', erreur: 'SMTP indisponible', fin: new Date() } })
    const org = await prisma.organization.create({ data: { id: `t-wh-${Date.now()}`, nom: 'WH', slug: `t-wh-${Date.now()}`, path: '/x/' } })
    const wh = await prisma.webhook.create({ data: { organizationId: org.id, name: 'test', url: 'https://exemple.test/hook', secret: 's', events: ['incident.created'] } })
    await prisma.webhookDelivery.create({ data: { webhookId: wh.id, event: 'incident.created', payload: '{}', statut: 'ECHEC', tentatives: 8 } })
    const etat = await (await GET()).json()
    const relances = etat.taches.find((t: { tache: string }) => t.tache === 'relances')
    expect(relances.derniere).toMatchObject({ statut: 'ECHEC', erreur: 'SMTP indisponible' })
    expect(relances.echecs7j).toBeGreaterThan(0)
    expect(etat.webhooks.enEchec).toBeGreaterThan(0)
    const r = await post({ action: 'relancer-webhooks' })
    expect(r.status).toBe(200)
    expect((await r.json()).remis).toBeGreaterThan(0)
    expect(await prisma.webhookDelivery.count({ where: { webhookId: wh.id, statut: 'EN_ATTENTE', tentatives: 0 } })).toBe(1)
  })
})
