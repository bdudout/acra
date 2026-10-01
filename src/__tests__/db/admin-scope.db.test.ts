/**
 * T25 (audit 2026-10-01) : un compte au rôle ADMIN GLOBAL, administrateur de A mais
 * simple LECTEUR de B, n'administre RIEN dans B (comptes, corbeille, journal d'audit).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser, jsonRequest } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ ok: false })) }))
// Cookie d'organisation active : l'attaquant sélectionne B (il en est membre) avant d'agir.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { PATCH as patchUser } from '@/app/api/admin/users/route'
import { GET as getRecovery } from '@/app/api/admin/recovery/route'
import { GET as getAuditLog } from '@/app/api/admin/audit-log/route'

afterAll(async () => { await prisma.$disconnect() })

let A: { id: string }, B: { id: string }, actor: { id: string; role: string }
beforeAll(async () => {
  A = await makeOrg('A'); B = await makeOrg('B')
  actor = await makeUser('ADMIN', [{ id: A.id, role: 'ADMIN' }, { id: B.id, role: 'LECTEUR' }])
  session.user = { id: actor.id, role: 'ADMIN' }
})

describe('T25 — périmètre d\'administration = rôle effectif', () => {
  it('ne réinitialise pas le mot de passe d\'un compte de B (où il n\'est que LECTEUR)', async () => {
    session.activeOrg = B.id
    const victim = await makeUser('ANALYSTE', [B])
    const res = await patchUser(jsonRequest({ userId: victim.id, action: 'reset-password' }))
    expect(res.status).toBe(403)
    expect((await res.json()).tempPassword).toBeUndefined()
  })

  it('réinitialise toujours le mot de passe d\'un compte de A (qu\'il administre)', async () => {
    session.activeOrg = A.id
    const member = await makeUser('ANALYSTE', [A])
    const res = await patchUser(jsonRequest({ userId: member.id, action: 'reset-password' }))
    expect(res.status).toBe(200)
  })

  it('ne voit pas la corbeille de B', async () => {
    session.activeOrg = B.id
    const author = await makeUser('ANALYSTE', [B])
    const trashed = await prisma.analyse.create({ data: { userId: author.id, nom: 'corbeille B', organizationId: B.id, deletedAt: new Date() } })
    const { analyses } = await (await getRecovery(jsonRequest({}) as never)).json() as { analyses: { id: string }[] }
    expect(analyses.map(a => a.id)).not.toContain(trashed.id)
  })

  it('ne lit pas le journal d\'audit de B, même en ayant B comme organisation active', async () => {
    session.activeOrg = B.id
    await prisma.auditLog.create({ data: { action: 'EXPORT', organizationId: B.id, details: 'journal de B' } })
    await prisma.auditLog.create({ data: { action: 'EXPORT', organizationId: A.id, details: 'journal de A' } })
    const res = await getAuditLog(new Request('http://test.local/api/admin/audit-log?limit=100') as never)
    const { logs } = await res.json() as { logs: { organizationId: string | null }[] }
    expect(logs.some(l => l.organizationId === B.id)).toBe(false)
  })
})
