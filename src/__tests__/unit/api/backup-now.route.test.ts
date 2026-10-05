// @vitest-environment node
// POST /api/admin/backup/now : sauvegarde manuelle immédiate, déposée pour l'agent hôte (SUPER_ADMIN).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const role = { value: 'SUPER_ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: role.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))

import { POST } from '@/app/api/admin/backup/now/route'
let dir = ''
const req = () => ({ json: async () => ({}) }) as never
beforeEach(() => {
  vi.clearAllMocks(); role.value = 'SUPER_ADMIN'
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acra-now-')); process.env.ACRA_UPDATE_DIR = dir
  fs.mkdirSync(path.join(dir, 'inbox')); fs.writeFileSync(path.join(dir, 'agent.json'), JSON.stringify({ at: new Date().toISOString() }))
})
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.ACRA_UPDATE_DIR })

describe('/api/admin/backup/now', () => {
  it('202 : dépose la demande backup-now et journalise', async () => {
    expect((await POST(req())).status).toBe(202)
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'inbox', 'request.json'), 'utf8'))).toMatchObject({ action: 'backup-now', requestedBy: 'u1' })
    expect(auditLog).toHaveBeenCalledWith('INSTANCE_BACKUP_REQUESTED', expect.objectContaining({ userId: 'u1' }))
  })
  it('409 : agent absent, demande en attente ou mise à jour en cours', async () => {
    fs.writeFileSync(path.join(dir, 'inbox', 'request.json'), '{}')
    expect(await (await POST(req())).json()).toEqual({ error: 'request_pending' })
    fs.rmSync(path.join(dir, 'inbox', 'request.json'))
    fs.mkdirSync(path.join(dir, 'run')); fs.writeFileSync(path.join(dir, 'run', 'current.json'), JSON.stringify({ schema: 1, runId: 'r', kind: 'update', state: 'MIGRATE', from: { version: '1.0.4', sha: 'aaaaaaa' }, to: { version: '1.0.5', sha: 'bbbbbbb' }, snapshotId: null, startedAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', steps: [] }))
    expect(await (await POST(req())).json()).toEqual({ error: 'update_in_progress' })
    fs.rmSync(path.join(dir, 'run'), { recursive: true }); fs.rmSync(path.join(dir, 'agent.json'))
    expect(await (await POST(req())).json()).toEqual({ error: 'agent_unavailable' })
    expect(auditLog).not.toHaveBeenCalled()
  })
  it('403 hors super-administrateur', async () => {
    role.value = 'ADMIN'; expect((await POST(req())).status).toBe(403)
  })
})
