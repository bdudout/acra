/**
 * CWE-863 (2026-10-16) : les routes `[id]` qui cherchent une ressource dans tout le périmètre
 * visible appliquaient le rôle de l'organisation ACTIVE. Scénario : ADMIN « sous-arbre » du
 * groupe A (organisation active), mais LECTEUR direct de sa filiale C. Il ne doit RIEN pouvoir
 * modifier dans C. Contrôle positif : promu ADMIN de C, la même suppression réussit.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { DELETE as deleteRiskItem } from '@/app/api/risk-items/[id]/route'
import { DELETE as deleteKri } from '@/app/api/kri/[id]/route'
import { DELETE as deleteProcessus } from '@/app/api/processus/[id]/route'
import { DELETE as deleteControle } from '@/app/api/controles/[id]/route'
import { DELETE as deleteMission } from '@/app/api/audit/missions/[id]/route'

afterAll(async () => { await prisma.$disconnect() })

type Handler = (req: never, ctx: never) => Promise<Response>
const del = (handler: unknown, id: string) =>
  (handler as Handler)(new Request('http://test.local/api', { method: 'DELETE', headers: { 'x-forwarded-for': '10.8.0.1' } }) as never, { params: Promise.resolve({ id }) } as never)

let A: { id: string }, C: { id: string }, actor: { id: string }
beforeAll(async () => {
  A = await makeOrg('Groupe')
  const cId = `${A.id}-c`
  C = await prisma.organization.create({ data: { id: cId, nom: `Filiale ${cId}`, slug: cId, parentId: A.id, path: `/${A.id}/${cId}/` } })
  for (const org of [A, C]) {
    await prisma.organizationConfig.upsert({
      where: { id: org.id }, update: {},
      create: { id: org.id, controlePermanentActive: true, auditInterneActive: true, kriActive: true },
    })
  }
  actor = await makeUser('ANALYSTE')
  await prisma.orgMembership.create({ data: { userId: actor.id, organizationId: A.id, role: 'ADMIN', scope: 'SUBTREE' } })
  await prisma.orgMembership.create({ data: { userId: actor.id, organizationId: C.id, role: 'LECTEUR', scope: 'NODE' } })
  session.user = { id: actor.id, role: 'ANALYSTE' }
  session.activeOrg = A.id
})

const RESSOURCES = [
  { nom: 'risque (registre)', handler: deleteRiskItem, creer: () => prisma.riskItem.create({ data: { organizationId: C.id, intitule: 'R' } }), existe: (id: string) => prisma.riskItem.findUnique({ where: { id } }) },
  { nom: 'KRI', handler: deleteKri, creer: () => prisma.kri.create({ data: { organizationId: C.id, intitule: 'K' } }), existe: (id: string) => prisma.kri.findUnique({ where: { id } }) },
  { nom: 'processus', handler: deleteProcessus, creer: () => prisma.processus.create({ data: { organizationId: C.id, nom: 'P' } }), existe: (id: string) => prisma.processus.findUnique({ where: { id } }) },
  { nom: 'contrôle', handler: deleteControle, creer: () => prisma.controle.create({ data: { organizationId: C.id, intitule: 'Ctl' } }), existe: (id: string) => prisma.controle.findUnique({ where: { id } }) },
  { nom: 'mission d\'audit', handler: deleteMission, creer: () => prisma.auditMission.create({ data: { organizationId: C.id, intitule: 'M' } }), existe: (id: string) => prisma.auditMission.findUnique({ where: { id } }) },
]

describe('rôle évalué sur l\'organisation de la ressource', () => {
  for (const r of RESSOURCES) {
    it(`${r.nom} de la filiale : LECTEUR de C → refus, puis ADMIN de C → suppression`, async () => {
      await prisma.orgMembership.updateMany({ where: { userId: actor.id, organizationId: C.id }, data: { role: 'LECTEUR' } })
      const res = await r.creer()
      const refus = await del(r.handler, res.id)
      expect(refus.status).toBe(403)
      expect(await r.existe(res.id)).not.toBeNull()

      await prisma.orgMembership.updateMany({ where: { userId: actor.id, organizationId: C.id }, data: { role: 'ADMIN' } })
      const ok = await del(r.handler, res.id)
      expect(ok.status, await ok.clone().text()).toBe(200)
      expect(await r.existe(res.id)).toBeNull()
    })
  }
})
