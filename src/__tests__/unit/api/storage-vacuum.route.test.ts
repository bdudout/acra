// @vitest-environment node
// POST /api/admin/storage/vacuum : VACUUM (ANALYZE) simple sur les tables candidates (SUPER_ADMIN), jamais VACUUM FULL.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const role = { value: 'SUPER_ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: role.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))
const m = vi.hoisted(() => ({ vacuumTables: vi.fn() }))
vi.mock('@/lib/storage-usage.server', () => ({ vacuumTables: m.vacuumTables }))

import { POST } from '@/app/api/admin/storage/vacuum/route'
const req = (b?: unknown) => ({ json: async () => b ?? {} }) as never
beforeEach(() => { vi.clearAllMocks(); role.value = 'SUPER_ADMIN'; m.vacuumTables.mockResolvedValue({ ok: true, vacuumed: ['AuditLog'], skipped: [] }) })

describe('/api/admin/storage/vacuum', () => {
  it('200 : exécute sur les tables demandées et journalise les noms uniquement', async () => {
    const res = await POST(req({ tables: ['AuditLog'] }))
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ vacuumed: ['AuditLog'], skipped: [] })
    expect(m.vacuumTables).toHaveBeenCalledWith(['AuditLog'])
    expect(auditLog).toHaveBeenCalledWith('INSTANCE_VACUUM_RUN', expect.objectContaining({ details: { tables: ['AuditLog'] } }))
  })
  it('409 si un VACUUM est déjà en cours ; 400 si rien à traiter', async () => {
    m.vacuumTables.mockResolvedValue({ ok: false, error: 'already_running' }); expect((await POST(req({}))).status).toBe(409)
    m.vacuumTables.mockResolvedValue({ ok: true, vacuumed: [], skipped: ['X'] }); expect((await POST(req({ tables: ['X'] }))).status).toBe(400)
    expect(auditLog).not.toHaveBeenCalled()
  })
  it('403 hors super-administrateur', async () => {
    role.value = 'ADMIN'; expect((await POST(req({}))).status).toBe(403); expect(m.vacuumTables).not.toHaveBeenCalled()
  })
})
