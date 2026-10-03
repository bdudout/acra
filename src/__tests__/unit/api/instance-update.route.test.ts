// @vitest-environment node
// #185 — POST /api/admin/version/update : dépôt d'une demande pour l'agent hôte.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const role = { value: 'SUPER_ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: role.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))

import { GET, POST } from '@/app/api/admin/version/update/route'
import { DEFAULT_BACKUP_POLICY } from '@/lib/backup-policy'

let dir = ''
const req = (b: unknown) => ({ json: async () => b }) as never
const beat = (at = new Date().toISOString()) => fs.writeFileSync(path.join(dir, 'agent.json'), JSON.stringify({ at }))

beforeEach(() => {
  vi.clearAllMocks(); role.value = 'SUPER_ADMIN'
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acra-upd-')); process.env.ACRA_UPDATE_DIR = dir
})
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.ACRA_UPDATE_DIR })

describe('/api/admin/version/update', () => {
  it('agent actif : dépose une demande ne contenant que le canal, journalisée', async () => {
    fs.mkdirSync(path.join(dir, 'inbox')); beat()
    const res = await POST(req({ channel: 'stable' }))
    expect(res.status).toBe(202)
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'inbox', 'request.json'), 'utf8'))
    expect(Object.keys(written).sort()).toEqual(['action', 'channel', 'id', 'requestedAt', 'requestedBy'])
    expect(written.channel).toBe('stable')
    expect(auditLog).toHaveBeenCalledOnce()
  })
  it('agent non installé ou pulsation ancienne → 409, rien d’écrit', async () => {
    expect((await POST(req({ channel: 'stable' }))).status).toBe(409)
    fs.mkdirSync(path.join(dir, 'inbox')); beat('2020-01-01T00:00:00Z')
    expect((await POST(req({ channel: 'stable' }))).status).toBe(409)
    expect(fs.existsSync(path.join(dir, 'inbox', 'request.json'))).toBe(false)
  })
  it('canal inconnu → 400 ; mise à jour déjà en cours → 409', async () => {
    fs.mkdirSync(path.join(dir, 'inbox')); beat()
    expect((await POST(req({ channel: 'main; rm -rf /' }))).status).toBe(400)
    fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ state: 'RUNNING' }))
    expect((await POST(req({ channel: 'beta' }))).status).toBe(409)
  })
  it('réservé au super-administrateur', async () => {
    role.value = 'ADMIN'
    expect((await POST(req({ channel: 'stable' }))).status).toBe(403)
    expect((await GET()).status).toBe(403)
  })
  it('GET : disponibilité de l’agent et dernier statut assaini', async () => {
    fs.mkdirSync(path.join(dir, 'inbox')); beat()
    fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ state: 'SUCCESS', channel: 'stable', version: '1.0.3', secret: 'x' }))
    expect(await (await GET()).json()).toEqual({ agentAvailable: true, status: { state: 'SUCCESS', channel: 'stable', version: '1.0.3' }, snapshots: [], run: null, offsite: null, backup: { policy: DEFAULT_BACKUP_POLICY, stats: null } })
  })
})
