/** Liste des actions du journal (T14) : même résultat qu'un DISTINCT, via l'index. */
import { describe, it, expect, vi, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }))

import { GET } from '@/app/api/admin/audit-log/route'

afterAll(async () => { await prisma.$disconnect() })
const get = () => GET(new Request('http://test.local/api/admin/audit-log?page=1') as never)

describe('GET /api/admin/audit-log — actions disponibles', () => {
  it('SUPER_ADMIN : toutes les actions présentes en base, triées, sans doublon', async () => {
    const sa = await makeUser('SUPER_ADMIN')
    session.user = { id: sa.id, role: 'SUPER_ADMIN' }
    const res = await get()
    expect(res.status).toBe(200)
    const { availableActions } = await res.json() as { availableActions: string[] }
    const expected = (await prisma.auditLog.findMany({ select: { action: true }, distinct: ['action'], orderBy: { action: 'asc' } })).map(a => a.action)
    expect(availableActions).toEqual(expected)
  })

  it('ADMIN d\'organisation : seulement les actions de son périmètre', async () => {
    const org = await makeOrg()
    const admin = await makeUser('ADMIN', [org])
    await prisma.auditLog.create({ data: { action: 'ZZZ_ACTION_DE_TEST', organizationId: org.id } })
    await prisma.auditLog.create({ data: { action: 'ZZY_ACTION_AUTRE_ORG', organizationId: 'autre-org' } })
    session.user = { id: admin.id, role: 'ADMIN' }
    const { availableActions } = await (await get()).json() as { availableActions: string[] }
    expect(availableActions).toContain('ZZZ_ACTION_DE_TEST')
    expect(availableActions).not.toContain('ZZY_ACTION_AUTRE_ORG')
  })
})
