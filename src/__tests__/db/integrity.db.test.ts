/**
 * Intégrité et contrôle d'accès sur vraie base (audit 2026-09-30/10-01) :
 *  - D1 : une analyse ne disparaît pas avec son auteur (FK Restrict) ;
 *  - D2 : éditions concurrentes de la conformité sans perte (verrou de ligne) ;
 *  - S1/S4/T1 : suppression / réinitialisation d'un compte par un admin restreint.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser, jsonRequest } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ ok: false })) }))
vi.mock('@/lib/i18n', async importOriginal => ({ ...(await importOriginal<object>()), getServerLocale: async () => 'fr' }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }))

import { PATCH as patchOrgConformite } from '@/app/api/organizations/[orgId]/conformite/route'
import { DELETE as deleteUser, PATCH as patchUser } from '@/app/api/admin/users/route'

const as = (u: { id: string; role: string }) => { session.user = { id: u.id, role: u.role } }
beforeEach(() => { session.user = null })
afterAll(async () => { await prisma.$disconnect() })

describe('D1 — FK Analyse.userId en RESTRICT', () => {
  it('la base refuse de supprimer l\'auteur d\'une analyse', async () => {
    const org = await makeOrg()
    const author = await makeUser('ANALYSTE', [org])
    await prisma.analyse.create({ data: { userId: author.id, nom: 'preuve', organizationId: org.id } })
    await expect(prisma.user.delete({ where: { id: author.id } })).rejects.toMatchObject({ code: 'P2003' })
    expect(await prisma.analyse.count({ where: { userId: author.id } })).toBe(1)
  })
})

describe('D2 — conformité : éditions concurrentes via la vraie route', () => {
  // Organisation neuve : les 20 requêtes créent aussi la ligne Conformite en concurrence
  // (ancienne erreur 500 P2002, corrigée par ensureConformiteRow).
  it('20 éditions simultanées de 20 exigences différentes sont toutes conservées', async () => {
    const org = await makeOrg()
    const rssi = await makeUser('RSSI', [org])
    as(rssi)
    // Exigences réelles du référentiel ISO 27001 (contrôles de l'annexe A).
    const { getExigencesFor } = await import('@/lib/referentiel.server')
    const refs = (await getExigencesFor('ISO27001', org.id, 'fr')).slice(0, 20).map(e => e.ref)
    expect(refs.length).toBe(20)
    const results = await Promise.all(refs.map(ref =>
      patchOrgConformite(jsonRequest({ referentiel: 'ISO27001', ref, statut: 'conforme' }), { params: Promise.resolve({ orgId: org.id }) })))
    expect(results.map(r => r?.status)).toEqual(refs.map(() => 200))
    const row = await prisma.conformite.findFirstOrThrow({ where: { organizationId: org.id, referentiel: 'ISO27001' } })
    expect((row.entries as { ref: string }[]).map(e => e.ref).sort()).toEqual([...refs].sort())
  })
})

describe('S1/S4/T1 — gestion de comptes par un admin restreint', () => {
  it('un compte partagé avec une autre organisation est détaché, pas supprimé ; ses analyses restent', async () => {
    const [a, b] = [await makeOrg('A'), await makeOrg('B')]
    const admin = await makeUser('ADMIN', [a])
    const shared = await makeUser('RSSI', [a, b])
    await prisma.analyse.create({ data: { userId: shared.id, nom: 'analyse de B', organizationId: b.id } })
    as(admin)
    const res = await deleteUser(jsonRequest({ userId: shared.id }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ detached: true })
    expect(await prisma.user.findUnique({ where: { id: shared.id } })).not.toBeNull()
    expect((await prisma.orgMembership.findMany({ where: { userId: shared.id } })).map(m => m.organizationId)).toEqual([b.id])
    expect(await prisma.analyse.count({ where: { userId: shared.id, organizationId: b.id } })).toBe(1)
  })

  it('un ADMIN ne supprime pas un SUPER_ADMIN membre de son organisation', async () => {
    const a = await makeOrg('A')
    const admin = await makeUser('ADMIN', [a])
    const superAdmin = await makeUser('SUPER_ADMIN', [a])
    as(admin)
    expect((await deleteUser(jsonRequest({ userId: superAdmin.id }))).status).toBe(403)
    expect(await prisma.user.findUnique({ where: { id: superAdmin.id } })).not.toBeNull()
  })

  it('un ADMIN ne réinitialise pas le mot de passe d\'un SUPER_ADMIN (aucun mot de passe émis)', async () => {
    const a = await makeOrg('A')
    const admin = await makeUser('ADMIN', [a])
    const superAdmin = await makeUser('SUPER_ADMIN', [a])
    as(admin)
    const res = await patchUser(jsonRequest({ userId: superAdmin.id, action: 'reset-password' }))
    expect(res.status).toBe(403)
    expect((await res.json()).tempPassword).toBeUndefined()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: superAdmin.id } })).passwordHash).toBeNull()
  })

  it('le propriétaire d\'analyses entièrement dans le périmètre n\'est pas supprimé (409)', async () => {
    const a = await makeOrg('A')
    const admin = await makeUser('ADMIN', [a])
    const author = await makeUser('ANALYSTE', [a])
    await prisma.analyse.create({ data: { userId: author.id, nom: 'x', organizationId: a.id } })
    as(admin)
    const res = await deleteUser(jsonRequest({ userId: author.id }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('OWNS_ANALYSES')
  })

  it('T2 — réattribuer les analyses puis supprimer le compte ; rien ne part vers une autre organisation', async () => {
    const [a, b] = [await makeOrg('A'), await makeOrg('B')]
    const admin = await makeUser('ADMIN', [a])
    const leaver = await makeUser('ANALYSTE', [a])
    const successor = await makeUser('ANALYSTE', [a])
    const outsider = await makeUser('ANALYSTE', [b])
    await prisma.analyse.createMany({ data: [
      { userId: leaver.id, nom: 'a1', organizationId: a.id },
      { userId: leaver.id, nom: 'a2', organizationId: a.id },
    ] })
    as(admin)
    // Destinataire d'une autre organisation : refusé.
    expect((await patchUser(jsonRequest({ userId: leaver.id, action: 'reassign-analyses', toUserId: outsider.id }))).status).toBe(400)
    const res = await patchUser(jsonRequest({ userId: leaver.id, action: 'reassign-analyses', toUserId: successor.id }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ transferred: 2, remaining: 0 })
    expect(await prisma.analyse.count({ where: { userId: successor.id } })).toBe(2)
    expect((await deleteUser(jsonRequest({ userId: leaver.id }))).status).toBe(200)
    expect(await prisma.user.findUnique({ where: { id: leaver.id } })).toBeNull()
    expect(await prisma.auditLog.count({ where: { action: 'ANALYSE_REASSIGNED', targetId: leaver.id } })).toBe(1)
  })
})
