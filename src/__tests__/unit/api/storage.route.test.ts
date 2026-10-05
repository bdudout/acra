// @vitest-environment node
// /api/admin/storage : rapport complet (SUPER_ADMIN), part documents de son périmètre (ADMIN), seuils réglables (SUPER_ADMIN).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const role = { value: 'SUPER_ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: role.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))
const m = vi.hoisted(() => ({
  getStorageReport: vi.fn(), saveThresholds: vi.fn(), orgDocumentsUsage: vi.fn(), getAccessibleOrgIds: vi.fn(),
}))
vi.mock('@/lib/storage-usage.server', () => ({ getStorageReport: m.getStorageReport, saveThresholds: m.saveThresholds, orgDocumentsUsage: m.orgDocumentsUsage, resetStorageCache: vi.fn() }))
vi.mock('@/lib/org-context.server', () => ({ getAccessibleOrgIds: m.getAccessibleOrgIds }))

import { GET, PUT } from '@/app/api/admin/storage/route'

const req = (b?: unknown, qs = '') => ({ json: async () => b ?? {}, nextUrl: { searchParams: new URLSearchParams(qs) } }) as never
beforeEach(() => {
  vi.clearAllMocks(); role.value = 'SUPER_ADMIN'
  m.getStorageReport.mockResolvedValue({ measuredAt: 'x', db: { totalBytes: 1 } })
  m.orgDocumentsUsage.mockResolvedValue({ count: 2, totalBytes: 10 })
  m.getAccessibleOrgIds.mockResolvedValue({ all: false, ids: ['o1'] })
})

describe('GET /api/admin/storage', () => {
  it('SUPER_ADMIN : rapport complet (cache) ; ?fresh=1 force la mesure', async () => {
    expect(await (await GET(req())).json()).toMatchObject({ scope: 'instance', report: { db: { totalBytes: 1 } } })
    expect(m.getStorageReport).toHaveBeenCalledWith({ fresh: false })
    await GET(req(undefined, 'fresh=1')); expect(m.getStorageReport).toHaveBeenLastCalledWith({ fresh: true })
  })
  it('ADMIN : uniquement les documents de son périmètre, jamais le rapport d’instance', async () => {
    role.value = 'ADMIN'
    const j = await (await GET(req())).json()
    expect(j).toEqual({ scope: 'organization', documents: { count: 2, totalBytes: 10 } })
    expect(m.orgDocumentsUsage).toHaveBeenCalledWith({ all: false, ids: ['o1'] })
    expect(m.getStorageReport).not.toHaveBeenCalled()
  })
  it('403 pour un rôle non administrateur', async () => {
    role.value = 'ANALYSTE'; expect((await GET(req())).status).toBe(403)
  })
})

describe('PUT /api/admin/storage (seuils)', () => {
  it('enregistre des seuils valides et journalise', async () => {
    const res = await PUT(req({ warnPercent: 70, criticalPercent: 95 }))
    expect(res.status).toBe(200)
    expect(m.saveThresholds).toHaveBeenCalledWith({ warnPercent: 70, criticalPercent: 95 })
    expect(auditLog).toHaveBeenCalledWith('INSTANCE_STORAGE_THRESHOLDS_CHANGED', expect.objectContaining({ details: { warnPercent: 70, criticalPercent: 95 } }))
  })
  it('400 si incohérents ; 403 hors SUPER_ADMIN', async () => {
    expect((await PUT(req({ warnPercent: 95, criticalPercent: 90 }))).status).toBe(400)
    role.value = 'ADMIN'; expect((await PUT(req({ warnPercent: 70, criticalPercent: 95 }))).status).toBe(403)
    expect(m.saveThresholds).not.toHaveBeenCalled()
  })
})
