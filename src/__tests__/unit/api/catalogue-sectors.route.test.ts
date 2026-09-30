import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ update: vi.fn() }))
const auth = vi.hoisted(() => ({ scope: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'user1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { organization: db } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: auth.scope }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))

import { PUT } from '@/app/api/catalogue-suggestions/sectors/route'
const request = (body: object) => ({ json: async () => body }) as never

beforeEach(() => {
  vi.clearAllMocks()
  auth.scope.mockResolvedValue({ activeOrgId: 'sub1', role: 'ADMIN' })
  db.update.mockImplementation(async ({ data }: { data: object }) => ({ id: 'sub1', ...data }))
})

describe('secteurs d’activité d’une organisation', () => {
  it('permet à l’ADMIN local de mémoriser plusieurs secteurs sans créer de risque', async () => {
    const res = await PUT(request({ sectors: ['SANTE', 'SAAS'] }))
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sub1' }, data: { secteursActivite: ['SANTE', 'SAAS'] },
    }))
  })
  it('refuse un rôle non admin et un secteur inconnu', async () => {
    auth.scope.mockResolvedValue({ activeOrgId: 'sub1', role: 'ANALYSTE' })
    expect((await PUT(request({ sectors: ['SANTE'] }))).status).toBe(403)
    auth.scope.mockResolvedValue({ activeOrgId: 'sub1', role: 'ADMIN' })
    expect((await PUT(request({ sectors: ['INCONNU'] }))).status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })
})
