// @vitest-environment node
// /api/admin/storage/cleanup (aperçu, exécution, réglages) et /api/cron/cleanup : SUPER_ADMIN / CRON_SECRET, audit sans contenu.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const role = { value: 'SUPER_ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: role.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))
const inst = vi.hoisted(() => ({
  getCleanupSettings: vi.fn(), saveCleanupSettings: vi.fn(), previewInstanceCleanup: vi.fn(), executeInstanceCleanup: vi.fn(),
}))
vi.mock('@/lib/cache-cleanup.instance.server', () => inst)

import { GET, POST, PUT } from '@/app/api/admin/storage/cleanup/route'
import { POST as CRON } from '@/app/api/cron/cleanup/route'

const req = (b?: unknown, headers: Record<string, string> = {}) => ({ json: async () => b ?? {}, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as never
const settings = { autoCleanup: true, categories: ['B1', 'B4'], lastCleanupAt: null, lastCleanupCounts: null }
beforeEach(() => {
  vi.clearAllMocks(); role.value = 'SUPER_ADMIN'; process.env.CRON_SECRET = 'secret-secret-secret'
  inst.getCleanupSettings.mockResolvedValue(settings)
  inst.previewInstanceCleanup.mockResolvedValue([{ id: 'B1', count: 4, bytes: 800 }])
  inst.executeInstanceCleanup.mockResolvedValue({ ok: true, counts: { B1: 4 } })
})

describe('/api/admin/storage/cleanup', () => {
  it('GET : aperçu des catégories par défaut + réglages ; ?categories restreint', async () => {
    const res = await GET({ nextUrl: { searchParams: new URLSearchParams('categories=B1,B7,AuditLog') } } as never)
    expect(res.status).toBe(200)
    expect(inst.previewInstanceCleanup).toHaveBeenCalledWith(['B1', 'B7'])
    expect(await res.json()).toMatchObject({ preview: [{ id: 'B1', count: 4 }], settings })
  })
  it('POST : exécute les catégories demandées (assainies) et journalise les comptes uniquement', async () => {
    const res = await POST(req({ categories: ['B1', 'Risque'] }))
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ counts: { B1: 4 } })
    expect(inst.executeInstanceCleanup).toHaveBeenCalledWith(['B1'])
    expect(auditLog).toHaveBeenCalledWith('INSTANCE_CACHE_CLEANED', expect.objectContaining({ details: { counts: { B1: 4 }, trigger: 'manual' } }))
  })
  it('POST : 409 si une exécution est déjà en cours', async () => {
    inst.executeInstanceCleanup.mockResolvedValue({ ok: false, error: 'already_running' })
    expect((await POST(req({ categories: ['B1'] }))).status).toBe(409)
    expect(auditLog).not.toHaveBeenCalled()
  })
  it('PUT : enregistre bascule + catégories ; 400 si la bascule n’est pas booléenne', async () => {
    expect((await PUT(req({ autoCleanup: false, categories: ['B1', 'B2'] }))).status).toBe(200)
    expect(inst.saveCleanupSettings).toHaveBeenCalledWith({ autoCleanup: false, categories: ['B1', 'B2'] })
    expect((await PUT(req({ autoCleanup: 'oui' }))).status).toBe(400)
  })
  it('403 hors super-administrateur (GET, POST, PUT)', async () => {
    role.value = 'ADMIN'
    expect((await GET({ nextUrl: { searchParams: new URLSearchParams() } } as never)).status).toBe(403)
    expect((await POST(req({}))).status).toBe(403)
    expect((await PUT(req({ autoCleanup: true }))).status).toBe(403)
    expect(inst.executeInstanceCleanup).not.toHaveBeenCalled()
  })
})

describe('/api/cron/cleanup', () => {
  const auth = { authorization: 'Bearer secret-secret-secret' }
  it('401 sans secret valide, 503 sans CRON_SECRET', async () => {
    expect((await CRON(req({}, { authorization: 'Bearer nope' }))).status).toBe(401)
    delete process.env.CRON_SECRET
    expect((await CRON(req({}, auth))).status).toBe(503)
  })
  it('désactivé : ne supprime rien', async () => {
    inst.getCleanupSettings.mockResolvedValue({ ...settings, autoCleanup: false })
    const res = await CRON(req({}, auth))
    expect(await res.json()).toEqual({ skipped: true }); expect(inst.executeInstanceCleanup).not.toHaveBeenCalled()
  })
  it('actif : exécute les catégories configurées et journalise (trigger cron)', async () => {
    const res = await CRON(req({}, auth))
    expect(res.status).toBe(200)
    expect(inst.executeInstanceCleanup).toHaveBeenCalledWith(['B1', 'B4'])
    expect(auditLog).toHaveBeenCalledWith('INSTANCE_CACHE_CLEANED', expect.objectContaining({ details: { counts: { B1: 4 }, trigger: 'cron' } }))
  })
})
