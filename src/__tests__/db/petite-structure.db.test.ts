/**
 * Petite structure sur une vraie base, par les vraies routes : un RSSI (compte « analyste » au niveau
 * de l'instance) soumet et approuve sa propre analyse, valide seul un projet 360 et rend l'avis RSSI
 * sur sa propre dérogation — chaque cumul journalisé ; sans l'option, la séparation des tâches tient.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'acra_org' && session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { POST as approbation } from '@/app/api/analyses/[id]/approbation/route'
import { PATCH as derogation } from '@/app/api/derogations/[id]/route'

const req = (body: unknown) => new Request('http://t/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never
const p = (id: string) => ({ params: Promise.resolve({ id }) })
let petite: { id: string }, reglee: { id: string }, rssi: { id: string }, rssiRegle: { id: string }

beforeAll(async () => {
  petite = await makeOrg('Petite structure')
  reglee = await makeOrg('Organisation réglementée')
  await prisma.organizationConfig.create({ data: { id: petite.id, petiteStructure: true, derogationsActive: true, derogationWorkflow: 'RSSI' } })
  await prisma.organizationConfig.create({ data: { id: reglee.id, derogationsActive: true, derogationWorkflow: 'RSSI' } })
  rssi = await makeUser('ANALYSTE', [{ id: petite.id, role: 'RSSI' }])
  await makeUser('ANALYSTE', [{ id: petite.id, role: 'LECTEUR' }]) // l'organisation compte plus d'un membre
  rssiRegle = await makeUser('ANALYSTE', [{ id: reglee.id, role: 'RSSI' }])
})
afterAll(async () => { await prisma.$disconnect() })

// Le journal d'audit stocke ses détails en JSON texte.
const details = (l: { details: unknown } | null) => (typeof l?.details === 'string' ? JSON.parse(l.details) : l?.details)
const dernierAudit = (action: string, targetId: string) => prisma.auditLog.findFirst({ where: { action: action as never, targetId }, orderBy: { createdAt: 'desc' } })

describe('petite structure (vraie base)', () => {
  it('le RSSI soumet puis approuve sa propre analyse ; auto-approbation journalisée', async () => {
    const a = await prisma.analyse.create({ data: { nom: 'Analyse TPE', userId: rssi.id, organizationId: petite.id } })
    session.user = { id: rssi.id, role: 'ANALYSTE' }; session.activeOrg = petite.id
    expect((await approbation(req({ action: 'SOUMETTRE' }), p(a.id))).status).toBe(200)
    const r = await approbation(req({ action: 'APPROUVER', commentaire: 'Validé' }), p(a.id))
    expect(r.status).toBe(200)
    expect((await prisma.analyse.findUniqueOrThrow({ where: { id: a.id } })).statut).toBe('APPROUVE')
    const log = await dernierAudit('ANALYSE_APPROVED', a.id)
    expect(details(log)).toMatchObject({ selfApproval: true, petiteStructure: true })
  })

  it('projet 360 : une seule approbation suffit, tracée « cumul »', async () => {
    const a = await prisma.analyse.create({ data: { nom: 'Projet CRM', userId: rssi.id, organizationId: petite.id, methode: 'PROJET_360', statut: 'SOUMIS', soumisLe: new Date() } })
    session.user = { id: rssi.id, role: 'ANALYSTE' }; session.activeOrg = petite.id
    expect((await approbation(req({ action: 'APPROUVER' }), p(a.id))).status).toBe(200)
    const apres = await prisma.analyse.findUniqueOrThrow({ where: { id: a.id } })
    expect(apres.statut).toBe('APPROUVE')
    expect(apres.approbations).toMatchObject([{ role: 'RSSI', userId: rssi.id, cumul: true }])
  })

  it('dérogation : le RSSI demandeur rend lui-même l’avis, journalisé', async () => {
    const d = await prisma.derogation.create({ data: { organizationId: petite.id, portee: 'SOCLE', intitule: 'TLS 1.0', motif: 'm', mesuresCompensatoires: 'c', demandeurId: rssi.id, statut: 'DEMANDEE' } })
    session.user = { id: rssi.id, role: 'ANALYSTE' }; session.activeOrg = petite.id
    const r = await derogation(req({ action: 'AVIS_RSSI', favorable: true }), p(d.id))
    expect(r.status).toBe(200)
    expect((await prisma.derogation.findUniqueOrThrow({ where: { id: d.id } })).statut).toBe('ACTIVE')
    const log = await prisma.auditLog.findFirst({ where: { targetId: d.id }, orderBy: { createdAt: 'desc' } })
    expect(details(log)).toMatchObject({ petiteStructure: true, parLeDemandeur: true })
  })

  it('sans l’option : le RSSI ne soumet pas d’analyse ni n’avise sa propre dérogation (séparation des tâches)', async () => {
    const a = await prisma.analyse.create({ data: { nom: 'Analyse réglée', userId: rssiRegle.id, organizationId: reglee.id } })
    session.user = { id: rssiRegle.id, role: 'ANALYSTE' }; session.activeOrg = reglee.id
    expect((await approbation(req({ action: 'SOUMETTRE' }), p(a.id))).status).toBe(403)
    const d = await prisma.derogation.create({ data: { organizationId: reglee.id, portee: 'SOCLE', intitule: 'SMBv1', motif: 'm', mesuresCompensatoires: 'c', demandeurId: rssiRegle.id, statut: 'DEMANDEE' } })
    expect((await derogation(req({ action: 'AVIS_RSSI', favorable: true }), p(d.id))).status).toBe(403)
  })
})
