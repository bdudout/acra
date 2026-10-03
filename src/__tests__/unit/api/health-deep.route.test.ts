// @vitest-environment node
// Lot 4 — GET /api/health?deep=1 : état des migrations (dégradé + 503 si en attente ou en échec).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const queryRaw = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }))
const expected = vi.fn()
vi.mock('@/lib/migrations-on-disk.server', () => ({ listShippedMigrations: () => expected() }))

import { GET } from '@/app/api/health/route'

const req = (q = '') => ({ url: `http://localhost/api/health${q}` }) as never
const row = (n: string, f: string | null = '2026-10-01T00:00:00Z', r: string | null = null) => ({ migration_name: n, finished_at: f, rolled_back_at: r })

beforeEach(() => { vi.clearAllMocks(); queryRaw.mockResolvedValue([{ '?column?': 1 }]); expected.mockReturnValue(['001_a', '002_b']) })

describe('/api/health', () => {
  it('sans deep : aucune liste de migrations, aucune lecture de _prisma_migrations', async () => {
    const res = await GET(req())
    const body = await res.json()
    expect(res.status).toBe(200); expect(body.migrations).toBeUndefined(); expect(queryRaw).toHaveBeenCalledTimes(1)
  })
  it('deep : migrations à jour ⇒ 200 ok avec comptes', async () => {
    queryRaw.mockResolvedValueOnce([{ x: 1 }]).mockResolvedValueOnce([row('001_a'), row('002_b')])
    const res = await GET(req('?deep=1'))
    const body = await res.json()
    expect(res.status).toBe(200); expect(body.status).toBe('ok')
    expect(body.migrations).toEqual({ expected: 2, applied: 2, pending: [], failed: [] })
  })
  it('deep : migration en attente ⇒ 503 degraded', async () => {
    queryRaw.mockResolvedValueOnce([{ x: 1 }]).mockResolvedValueOnce([row('001_a')])
    const res = await GET(req('?deep=1'))
    expect(res.status).toBe(503); expect((await res.json()).migrations.pending).toEqual(['002_b'])
  })
  it('deep : migration en échec ⇒ 503 degraded', async () => {
    queryRaw.mockResolvedValueOnce([{ x: 1 }]).mockResolvedValueOnce([row('001_a'), row('002_b', null)])
    const res = await GET(req('?deep=1'))
    expect(res.status).toBe(503); expect((await res.json()).migrations.failed).toEqual(['002_b'])
  })
  it('deep sans dossier de migrations dans l’image : pas de verdict (200, migrations omis)', async () => {
    expected.mockReturnValue(null)
    const res = await GET(req('?deep=1'))
    expect(res.status).toBe(200); expect((await res.json()).migrations).toBeUndefined()
  })
  it('base injoignable ⇒ 503 db error', async () => {
    queryRaw.mockReset().mockRejectedValue(new Error('down'))
    const res = await GET(req('?deep=1'))
    expect(res.status).toBe(503); expect((await res.json()).db).toBe('error')
  })
})
