// @vitest-environment node
// Lot H1.4 — drainage d'un réplica avant son arrêt (scripts/update-ha.sh) : tant que le fichier de drainage existe,
// /api/health répond 503 « draining » (le frontal Caddy cesse d'y envoyer de nouvelles requêtes), sans interroger la base.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const queryRaw = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }))
vi.mock('@/lib/migrations-on-disk.server', () => ({ listShippedMigrations: () => ['001_a'] }))

import { GET } from '@/app/api/health/route'

const req = () => ({ url: 'http://localhost/api/health' }) as never
let dir: string
beforeEach(() => {
  vi.clearAllMocks()
  dir = mkdtempSync(path.join(tmpdir(), 'acra-drain-'))
  process.env.ACRA_DRAIN_FILE = path.join(dir, 'drain')
  queryRaw.mockResolvedValueOnce([{ x: 1 }]).mockResolvedValueOnce([{ migration_name: '001_a', finished_at: '2026-10-01T00:00:00Z', rolled_back_at: null }])
})
afterEach(() => { delete process.env.ACRA_DRAIN_FILE; rmSync(dir, { recursive: true, force: true }) })

describe('/api/health — drainage', () => {
  it('sans fichier de drainage : 200 ok', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('ok')
  })
  it('fichier de drainage présent : 503 draining, sans requête en base', async () => {
    writeFileSync(process.env.ACRA_DRAIN_FILE!, '')
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect((await res.json()).status).toBe('draining')
    expect(queryRaw).not.toHaveBeenCalled()
  })
})
