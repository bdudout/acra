/**
 * T9 — verrou optimiste des ateliers, sur base réelle. Deux éditeurs ouvrent l'atelier 2 à la
 * même révision ; le premier enregistre, le second (version périmée) est refusé en 409
 * CONFLIT_EDITION au lieu d'effacer silencieusement le travail du premier.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }))

import { PUT } from '@/app/api/analyses/[id]/workshop/[num]/route'

afterAll(async () => { await prisma.$disconnect() })

let analyseId: string
beforeAll(async () => {
  const org = await makeOrg('Verrou')
  const auteur = await makeUser('ANALYSTE', [{ id: org.id, role: 'ADMIN' }])
  session.user = { id: auteur.id, role: 'ANALYSTE' }
  analyseId = (await prisma.analyse.create({ data: { userId: auteur.id, nom: 'Verrou optimiste', organizationId: org.id } })).id
})

const save = (num: number, body: unknown, ifMatch?: number) =>
  PUT(new Request(`http://test.local/api/analyses/${analyseId}/workshop/${num}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.7.0.1', ...(ifMatch !== undefined ? { 'if-match': String(ifMatch) } : {}) },
    body: JSON.stringify(body),
  }) as never, { params: Promise.resolve({ id: analyseId, num: String(num) }) })

const sources = () => prisma.sourceRisque.findMany({ where: { analyseId }, select: { nom: true } })

describe('verrou optimiste des ateliers', () => {
  it('deux éditeurs à la même révision : le second est refusé, le travail du premier est conservé', async () => {
    const r1 = await save(2, { sourcesRisque: [{ nom: 'Cybercriminel', categorie: 'AUTRE' }] }, 0)
    expect(r1.status, await r1.clone().text()).toBe(200)
    expect((await r1.json()).revision).toBe(1)

    const r2 = await save(2, { sourcesRisque: [] }, 0)
    expect(r2.status).toBe(409)
    expect(await r2.json()).toEqual({ error: 'CONFLIT_EDITION', revision: 1 })
    expect(await sources()).toEqual([{ nom: 'Cybercriminel' }])
  })

  it('le premier éditeur continue avec la révision renvoyée', async () => {
    const r = await save(2, { sourcesRisque: [{ nom: 'Cybercriminel', categorie: 'AUTRE' }, { nom: 'Initié', categorie: 'AUTRE' }] }, 1)
    expect(r.status).toBe(200)
    expect((await r.json()).revision).toBe(2)
  })

  it('les ateliers sont indépendants : enregistrer l\'atelier 3 ne crée pas de conflit sur le 2', async () => {
    expect((await save(3, { partiesPrenantes: [], scenariosStrategiques: [] }, 0)).status).toBe(200)
    expect((await save(2, { sourcesRisque: [{ nom: 'Cybercriminel', categorie: 'AUTRE' }, { nom: 'Initié', categorie: 'AUTRE' }] }, 2)).status).toBe(200)
  })

  it('sans If-Match (autres clients) : enregistré, révision incrémentée', async () => {
    const r = await save(4, { scenariosOperationnels: [] })
    expect(r.status).toBe(200)
    expect((await r.json()).revision).toBe(1)
  })

  it('un enregistrement refusé (400) ne consomme pas de révision', async () => {
    const avant = (await prisma.analyse.findUniqueOrThrow({ where: { id: analyseId }, select: { revisionAtelier1: true } })).revisionAtelier1
    const r = await save(1, { socleSecurite: [{ ref: 'A.5.1', statut: 'na' }] }, avant)
    expect(r.status).toBe(400)
    const apres = (await prisma.analyse.findUniqueOrThrow({ where: { id: analyseId }, select: { revisionAtelier1: true } })).revisionAtelier1
    expect(apres).toBe(avant)
  })
})
