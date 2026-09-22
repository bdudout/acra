/**
 * Activation des méthodes d'analyse à l'instance (/api/admin/methodes-config).
 * Réservé au SUPER_ADMIN ; PUT assainit (câblées seulement, EBIOS RM imposé).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

const role = { value: 'SUPER_ADMIN' as string }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'sa', role: role.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
const configUpdate = vi.fn(async (..._a: unknown[]) => ({}))
const configFindUnique = vi.fn(async (..._a: unknown[]) => ({ methodesActives: ['EBIOS_RM', 'ISO_31000'] }))
vi.mock('@/lib/prisma', () => ({
  prisma: { configuration: { findUnique: (...a: unknown[]) => configFindUnique(...a), update: (...a: unknown[]) => configUpdate(...a) } },
}))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '') }))

import { GET, PUT } from '@/app/api/admin/methodes-config/route'
const argOf = (fn: { mock: { calls: unknown[][] } }) => fn.mock.calls[0][0] as { data: { methodesActives: string[] } }
const req = (body: unknown) => ({ json: async () => body }) as never

beforeEach(() => { vi.clearAllMocks(); role.value = 'SUPER_ADMIN' })

describe('methodes-config', () => {
  it('GET renvoie actives + câblées (SUPER_ADMIN)', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.active).toContain('EBIOS_RM')
    expect(d.implemented).toContain('EBIOS_RM')
  })

  it('non SUPER_ADMIN → 403', async () => {
    role.value = 'ADMIN'
    expect((await GET()).status).toBe(403)
    expect((await PUT(req({ methodes: ['ISO_31000'] }))).status).toBe(403)
    expect(configUpdate).not.toHaveBeenCalled()
  })

  it('PUT assainit : EBIOS RM imposé, méthode non câblée écartée', async () => {
    // NIST_800_30 n'est pas câblée → écartée ; EBIOS RM imposé.
    const res = await PUT(req({ methodes: ['ISO_31000', 'NIST_800_30'] }))
    expect(res.status).toBe(200)
    expect(argOf(configUpdate).data.methodesActives).toEqual(['EBIOS_RM', 'ISO_31000'])
  })

  it('PUT sans tableau → 400', async () => {
    expect((await PUT(req({ methodes: 'x' }))).status).toBe(400)
    expect(configUpdate).not.toHaveBeenCalled()
  })
})
