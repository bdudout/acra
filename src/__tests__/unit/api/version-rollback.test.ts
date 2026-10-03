// @vitest-environment node
// Lot 3 — POST /api/admin/version/rollback : demande de retour à un point de restauration, déposée pour l'agent hôte.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const role = { value: 'SUPER_ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: role.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))

import { POST } from '@/app/api/admin/version/rollback/route'

const ID = '20261003T101500Z-pre-update-1.0.4'
let dir = ''
const req = (b: unknown) => ({ json: async () => b }) as never
const beat = () => fs.writeFileSync(path.join(dir, 'agent.json'), JSON.stringify({ at: new Date().toISOString() }))
const index = (ids = [ID]) => fs.writeFileSync(path.join(dir, 'snapshots.json'), JSON.stringify({ schema: 1, snapshots: ids.map(id => ({ id, reason: 'pre-update', createdAt: '2026-10-03T10:15:00Z', version: '1.0.4', toVersion: '1.0.5', verified: 'full', clone: true, documents: true, encrypted: false, sizeBytes: 5 })) }))

beforeEach(() => {
  vi.clearAllMocks(); role.value = 'SUPER_ADMIN'
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acra-rb-')); process.env.ACRA_UPDATE_DIR = dir
  fs.mkdirSync(path.join(dir, 'inbox')); beat(); index()
})
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.ACRA_UPDATE_DIR })

describe('/api/admin/version/rollback', () => {
  it('202 : dépose la demande (action rollback, point, version confirmée) et journalise', async () => {
    const res = await POST(req({ snapshotId: ID, confirmVersion: '1.0.4' }))
    expect(res.status).toBe(202)
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'inbox', 'request.json'), 'utf8'))
    expect(written).toMatchObject({ action: 'rollback', snapshotId: ID, confirmVersion: '1.0.4', requestedBy: 'u1' })
    expect(auditLog).toHaveBeenCalledWith('INSTANCE_ROLLBACK_REQUESTED', expect.objectContaining({ userId: 'u1', details: expect.objectContaining({ snapshotId: ID, toVersion: '1.0.4' }) }))
  })
  it('403 hors super-administrateur ; 401 sans session', async () => {
    role.value = 'ADMIN'
    expect((await POST(req({ snapshotId: ID, confirmVersion: '1.0.4' }))).status).toBe(403)
    expect(fs.existsSync(path.join(dir, 'inbox', 'request.json'))).toBe(false)
  })
  it('400 : identifiant hors index, invalide, ou version non confirmée ; aucune écriture', async () => {
    for (const body of [{ snapshotId: '20250101T000000Z-manual-9', confirmVersion: '9' }, { snapshotId: '../x', confirmVersion: '1.0.4' }, { snapshotId: ID, confirmVersion: '9.9.9' }, { snapshotId: ID }, {}]) {
      expect((await POST(req(body))).status, JSON.stringify(body)).toBe(400)
    }
    expect(fs.existsSync(path.join(dir, 'inbox', 'request.json'))).toBe(false)
    expect(auditLog).not.toHaveBeenCalled()
  })
  it('409 : agent absent ou mise à jour en cours', async () => {
    fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ state: 'RUNNING' }))
    expect((await POST(req({ snapshotId: ID, confirmVersion: '1.0.4' }))).status).toBe(409)
    fs.rmSync(path.join(dir, 'status.json')); fs.rmSync(path.join(dir, 'agent.json'))
    expect((await POST(req({ snapshotId: ID, confirmVersion: '1.0.4' }))).status).toBe(409)
  })
})
