// @vitest-environment node
// POST /api/admin/backup/prune : aperçu puis suppression (liste exacte) des points au-delà des N plus récents, via l'agent hôte.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const role = { value: 'SUPER_ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: role.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))

import { POST } from '@/app/api/admin/backup/prune/route'

let dir = ''
const req = (b: unknown) => ({ json: async () => b }) as never
const ent = (day: number, reason = 'scheduled', size = 100) => ({ id: `202610${String(day).padStart(2, '0')}T020000Z-${reason}-1.0.4`, reason, createdAt: `2026-10-${String(day).padStart(2, '0')}T02:00:00Z`, version: '1.0.4', verified: 'full', clone: false, documents: true, encrypted: false, sizeBytes: size })
const snaps = [ent(9), ent(8), ent(7), ent(6)]
const opts = { keepScheduled: 2, keepPreUpdate: 3, keepManual: 3, includeManual: false }
beforeEach(() => {
  vi.clearAllMocks(); role.value = 'SUPER_ADMIN'
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acra-prune-')); process.env.ACRA_UPDATE_DIR = dir
  fs.mkdirSync(path.join(dir, 'inbox')); fs.writeFileSync(path.join(dir, 'agent.json'), JSON.stringify({ at: new Date().toISOString() }))
  fs.writeFileSync(path.join(dir, 'snapshots.json'), JSON.stringify({ schema: 1, snapshots: snaps }))
})
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.ACRA_UPDATE_DIR })

describe('/api/admin/backup/prune', () => {
  it('aperçu (sans confirmCount) : liste supprimés/conservés et octets libérés, aucune écriture', async () => {
    const res = await POST(req(opts)); const j = await res.json()
    expect(res.status).toBe(200)
    expect(j.toDelete.map((x: { id: string }) => x.id)).toEqual([snaps[2].id, snaps[3].id])
    expect(j.toKeep).toHaveLength(2); expect(j.reclaimedBytes).toBe(200)
    expect(fs.existsSync(path.join(dir, 'inbox', 'request.json'))).toBe(false)
  })
  it('202 : confirmCount égal au nombre de points ⇒ demande backup-prune avec la liste exacte + audit', async () => {
    const res = await POST(req({ ...opts, confirmCount: 2 }))
    expect(res.status).toBe(202)
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'inbox', 'request.json'), 'utf8'))).toMatchObject({ action: 'backup-prune', ids: [snaps[2].id, snaps[3].id] })
    expect(auditLog).toHaveBeenCalledWith('INSTANCE_BACKUP_PRUNED', expect.objectContaining({ userId: 'u1', details: expect.objectContaining({ count: 2, bytes: 200 }) }))
  })
  it('400 confirm_mismatch si le nombre saisi diffère ; 400 keep_min_1 ; 400 nothing_to_prune', async () => {
    expect(await (await POST(req({ ...opts, confirmCount: 5 }))).json()).toMatchObject({ error: 'confirm_mismatch' })
    expect(await (await POST(req({ ...opts, keepScheduled: 0 }))).json()).toMatchObject({ error: 'keep_min_1' })
    expect(await (await POST(req({ ...opts, keepScheduled: 9, confirmCount: 0 }))).json()).toMatchObject({ error: 'nothing_to_prune' })
    expect(fs.existsSync(path.join(dir, 'inbox', 'request.json'))).toBe(false)
  })
  it('409 update_in_progress pendant une mise à jour', async () => {
    fs.mkdirSync(path.join(dir, 'run'))
    fs.writeFileSync(path.join(dir, 'run', 'current.json'), JSON.stringify({ schema: 1, runId: 'r1', kind: 'update', state: 'MIGRATE', from: { version: '1.0.4', sha: 'aaaaaaa' }, to: { version: '1.0.5', sha: 'bbbbbbb' }, snapshotId: snaps[2].id, startedAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', steps: [] }))
    const res = await POST(req({ ...opts, confirmCount: 1 }))
    expect(res.status).toBe(409); expect((await res.json()).error).toBe('update_in_progress')
  })
  it('403 hors super-administrateur ; 409 agent absent ou demande en attente', async () => {
    role.value = 'ADMIN'; expect((await POST(req({ ...opts, confirmCount: 2 }))).status).toBe(403); role.value = 'SUPER_ADMIN'
    fs.writeFileSync(path.join(dir, 'inbox', 'request.json'), '{}')
    expect((await POST(req({ ...opts, confirmCount: 2 }))).status).toBe(409)
    fs.rmSync(path.join(dir, 'inbox', 'request.json')); fs.rmSync(path.join(dir, 'agent.json'))
    expect((await POST(req({ ...opts, confirmCount: 2 }))).status).toBe(409)
  })
})
