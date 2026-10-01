/**
 * T23 : rattachement d'un compte à une organisation, DIRECT (sur site) ou par
 * INVITATION à accepter (instance ouverte au public : consentement, aucune
 * divulgation de l'existence d'un compte).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser, jsonRequest } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string; email?: string } }))
const mails = vi.hoisted(() => [] as { to: string; text: string }[])
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async (m: { to: string; text: string }) => { mails.push(m); return { ok: true } }) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }))

import { POST as addMember } from '@/app/api/organizations/[orgId]/entites/[entiteId]/membres/route'
import { GET as previewRoute, POST as acceptRoute } from '@/app/api/invitations/[token]/route'
import { PUT as putMembershipConfig } from '@/app/api/admin/membership-config/route'

let previousMode: { membershipMode: string; membershipNotify: boolean } | null = null
let A: { id: string }, admin: { id: string; email: string }

async function setMode(mode: string, notify = true) {
  await prisma.configuration.update({ where: { id: 'global' }, data: { membershipMode: mode, membershipNotify: notify } })
}
function invite(email: string, role = 'ANALYSTE'): Promise<Response> {
  session.user = { id: admin.id, role: 'ANALYSTE', email: admin.email }
  const req = jsonRequest({ email, role }) as unknown as Request
  return addMember(Object.assign(req, { cookies: { get: () => undefined } }) as never, { params: Promise.resolve({ orgId: A.id, entiteId: A.id }) }) as Promise<Response>
}
function tokenFromLastMail(to: string): string {
  const mail = [...mails].reverse().find(m => m.to === to)
  const m = mail?.text.match(/\/invitations\/([A-Za-z0-9_-]+)/)
  if (!m) throw new Error(`aucun lien d'invitation envoyé à ${to}`)
  return m[1]
}
const params = (token: string) => ({ params: Promise.resolve({ token }) })

beforeAll(async () => {
  process.env.NEXTAUTH_URL = 'http://test.local'
  const cfg = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { membershipMode: true, membershipNotify: true } })
  if (!cfg) await prisma.configuration.create({ data: { id: 'global', echelleGravite: [], echelleVraisemblance: [] } })
  previousMode = cfg
  A = await makeOrg('A')
  admin = await makeUser('ANALYSTE', [{ id: A.id, role: 'ADMIN' }])
})
afterAll(async () => {
  if (previousMode) await setMode(previousMode.membershipMode, previousMode.membershipNotify)
  await prisma.$disconnect()
})

describe('T23 — mode DIRECT', () => {
  it('rattache immédiatement un compte existant et l\'informe par e-mail', async () => {
    await setMode('DIRECT')
    const target = await makeUser('ANALYSTE')
    const res = await invite(target.email)
    expect(res.status).toBe(201)
    expect(await prisma.orgMembership.count({ where: { userId: target.id, organizationId: A.id } })).toBe(1)
    expect(mails.some(m => m.to === target.email)).toBe(true)
  })

  it('n\'envoie pas d\'e-mail d\'information quand la notification est désactivée', async () => {
    await setMode('DIRECT', false)
    const target = await makeUser('ANALYSTE')
    const before = mails.length
    expect((await invite(target.email)).status).toBe(201)
    expect(mails.length).toBe(before)
  })
})

describe('T23 — mode INVITATION', () => {
  it('répond à l\'identique qu\'un compte existe ou non, sans rattacher', async () => {
    await setMode('INVITATION')
    const existing = await makeUser('ANALYSTE')
    const r1 = await invite(existing.email)
    const r2 = await invite(`inconnu-${Date.now()}@test.acra`)
    expect(r1.status).toBe(202)
    expect(r2.status).toBe(202)
    expect(await r1.json()).toEqual(await r2.json())
    expect(await prisma.orgMembership.count({ where: { userId: existing.id, organizationId: A.id } })).toBe(0)
  })

  it('compte existant : seul le titulaire de l\'e-mail accepte, une seule fois', async () => {
    await setMode('INVITATION')
    const target = await makeUser('ANALYSTE')
    await invite(target.email, 'RISK_MANAGER')
    const token = tokenFromLastMail(target.email)
    // Le jeton est stocké haché, jamais en clair.
    expect(await prisma.orgInvitation.count({ where: { tokenHash: token } })).toBe(0)

    const preview = await (await previewRoute(jsonRequest({}) as never, params(token))).json()
    expect(preview).toMatchObject({ state: 'VALID', email: target.email, role: 'RISK_MANAGER', accountExists: true })

    session.user = null
    expect((await acceptRoute(jsonRequest({ name: 'Intrus', password: 'X' }) as never, params(token))).status).toBe(409) // LOGIN_REQUIRED

    const other = await makeUser('ANALYSTE')
    session.user = { id: other.id, role: 'ANALYSTE', email: other.email }
    expect((await acceptRoute(jsonRequest({}) as never, params(token))).status).toBe(403) // EMAIL_MISMATCH

    session.user = { id: target.id, role: 'ANALYSTE', email: target.email }
    expect((await acceptRoute(jsonRequest({}) as never, params(token))).status).toBe(200)
    const m = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId: target.id, organizationId: A.id } } })
    expect(m?.role).toBe('RISK_MANAGER')

    expect((await acceptRoute(jsonRequest({}) as never, params(token))).status).toBe(409) // USED
  })

  it('sans compte : le lien permet de créer le compte (e-mail vérifié) et rattache', async () => {
    await setMode('INVITATION')
    const email = `nouveau-${Date.now()}@test.acra`
    await invite(email)
    const token = tokenFromLastMail(email)
    session.user = null
    expect((await acceptRoute(jsonRequest({ name: 'N', password: 'court' }) as never, params(token))).status).toBe(400)
    const res = await acceptRoute(jsonRequest({ name: 'Nouvelle Personne', password: 'Un-Mot-De-Passe-Solide-2026!' }) as never, params(token))
    expect(res.status).toBe(200)
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, emailVerified: true } })
    expect(user?.role).toBe('ANALYSTE')
    expect(user?.emailVerified).not.toBeNull()
    expect(await prisma.orgMembership.count({ where: { userId: user!.id, organizationId: A.id } })).toBe(1)
  })

  it('une invitation expirée est refusée (410)', async () => {
    await setMode('INVITATION')
    const target = await makeUser('ANALYSTE')
    await invite(target.email)
    const token = tokenFromLastMail(target.email)
    await prisma.orgInvitation.updateMany({ where: { email: target.email }, data: { expiresAt: new Date(Date.now() - 1000) } })
    session.user = { id: target.id, role: 'ANALYSTE', email: target.email }
    expect((await acceptRoute(jsonRequest({}) as never, params(token))).status).toBe(410)
  })

  it('une nouvelle invitation remplace la précédente (ancien lien invalide)', async () => {
    await setMode('INVITATION')
    const target = await makeUser('ANALYSTE')
    await invite(target.email)
    const first = tokenFromLastMail(target.email)
    await invite(target.email)
    const second = tokenFromLastMail(target.email)
    expect(second).not.toBe(first)
    expect((await previewRoute(jsonRequest({}) as never, params(first))).status).toBe(404)
    expect(await prisma.orgInvitation.count({ where: { email: target.email, acceptedAt: null } })).toBe(1)
  })
})

describe('T23 — réglage d\'instance', () => {
  it('réservé au SUPER_ADMIN ; AUTO suit l\'ouverture de l\'instance', async () => {
    session.user = { id: admin.id, role: 'ADMIN', email: admin.email }
    const put = (body: unknown) => putMembershipConfig(Object.assign(jsonRequest(body), {}) as never)
    expect((await put({ mode: 'DIRECT' })).status).toBe(403)

    const sa = await makeUser('SUPER_ADMIN')
    session.user = { id: sa.id, role: 'SUPER_ADMIN', email: sa.email }
    expect((await put({ mode: 'NIMPORTE' })).status).toBe(400)
    const res = await put({ mode: 'AUTO' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mode).toBe('AUTO')
    expect(body.effective).toBe(body.instanceOpen ? 'INVITATION' : 'DIRECT')
  })
})
