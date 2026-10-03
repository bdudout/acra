// @vitest-environment node
// POST /api/admin/backup/policy : demande de nouvelle politique de sauvegarde, déposée pour l'agent hôte.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const role = { value: 'SUPER_ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: role.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))

import { POST } from '@/app/api/admin/backup/policy/route'
import { readUpdateAgent } from '@/lib/update-request.server'
import { DEFAULT_BACKUP_POLICY } from '@/lib/backup-policy'

let dir = ''
const req = (b: unknown) => ({ json: async () => b }) as never
const good = { daily: { enabled: true, keep: 7 }, weekly: { enabled: true, keep: 4, weekday: 0 }, monthly: { enabled: true, keep: 6, day: 1 }, hour: 3 }
beforeEach(() => {
  vi.clearAllMocks(); role.value = 'SUPER_ADMIN'
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acra-bp-')); process.env.ACRA_UPDATE_DIR = dir
  fs.mkdirSync(path.join(dir, 'inbox')); fs.writeFileSync(path.join(dir, 'agent.json'), JSON.stringify({ at: new Date().toISOString() }))
})
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.ACRA_UPDATE_DIR })

describe('/api/admin/backup/policy', () => {
  it('202 : dépose la demande (action backup-policy + politique validée) et journalise', async () => {
    const res = await POST(req({ policy: good }))
    expect(res.status).toBe(202)
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'inbox', 'request.json'), 'utf8'))
    expect(written).toMatchObject({ action: 'backup-policy', requestedBy: 'u1', policy: good })
    expect(auditLog).toHaveBeenCalledWith('INSTANCE_BACKUP_POLICY_CHANGED', expect.objectContaining({ userId: 'u1', details: expect.objectContaining({ daily: 7, weekly: 4, monthly: 6, hour: 3 }) }))
  })
  it('seuls les champs connus sont transmis (aucune clé inventée vers l’agent)', async () => {
    await POST(req({ policy: { ...good, evil: 'rm -rf /', daily: { ...good.daily, cmd: 'x' } } }))
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'inbox', 'request.json'), 'utf8'))
    expect(JSON.stringify(written)).not.toContain('evil'); expect(JSON.stringify(written)).not.toContain('"cmd"')
  })
  it('400 : politique invalide (conservation, heure, aucune fréquence) ; aucune écriture', async () => {
    for (const policy of [{ ...good, hour: 24 }, { ...good, daily: { enabled: true, keep: 0 } }, { daily: { enabled: false, keep: 3 }, weekly: { enabled: false, keep: 3, weekday: 0 }, monthly: { enabled: false, keep: 3, day: 1 }, hour: 2 }, null, 'x']) {
      expect((await POST(req({ policy }))).status).toBe(400)
    }
    expect(fs.existsSync(path.join(dir, 'inbox', 'request.json'))).toBe(false)
    expect(auditLog).not.toHaveBeenCalled()
  })
  it('403 hors super-administrateur', async () => {
    role.value = 'ADMIN'
    expect((await POST(req({ policy: good }))).status).toBe(403)
  })
  it('409 : agent absent, ou une demande est déjà en attente', async () => {
    fs.writeFileSync(path.join(dir, 'inbox', 'request.json'), '{}')
    expect((await POST(req({ policy: good }))).status).toBe(409)
    fs.rmSync(path.join(dir, 'inbox', 'request.json')); fs.rmSync(path.join(dir, 'agent.json'))
    expect((await POST(req({ policy: good }))).status).toBe(409)
  })
})

describe('lecture de la politique et des statistiques', () => {
  it('défauts sans fichier ; politique et statistiques lues, assainies', async () => {
    expect((await readUpdateAgent()).backup).toEqual({ policy: DEFAULT_BACKUP_POLICY, stats: null })
    fs.writeFileSync(path.join(dir, 'backup-policy.json'), JSON.stringify({ schema: 1, ...good }))
    fs.writeFileSync(path.join(dir, 'backup-stats.json'), JSON.stringify({ schema: 1, at: '2026-10-04T03:00:00Z', freeBytes: 1000, backupsBytes: 10, points: 1, scheduledPoints: 1, lastScheduledPointBytes: 5, lastPreUpdatePointBytes: null, dbBytes: 20, lastRunAt: null, lastCode: null, lastTiers: '' }))
    const b = (await readUpdateAgent()).backup
    expect(b.policy.daily.keep).toBe(7); expect(b.stats?.freeBytes).toBe(1000)
  })
})
