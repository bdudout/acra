// @vitest-environment node
// Lot 4 — journal d'audit après restauration : chaque ligne d'events.log n'est journalisée qu'une fois.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const findMany = vi.fn(); const createMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { instanceEvent: { findMany: (...a: unknown[]) => findMany(...a), createMany: (...a: unknown[]) => createMany(...a) } } }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a) }))

import { recordInstanceEvents } from '@/lib/instance-events.server'

let dir = ''
beforeEach(() => { vi.clearAllMocks(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acra-ev-')); process.env.ACRA_UPDATE_DIR = dir; findMany.mockResolvedValue([]); createMany.mockResolvedValue({ count: 0 }) })
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.ACRA_UPDATE_DIR })
const log = (t: string) => fs.writeFileSync(path.join(dir, 'events.log'), t)

describe('recordInstanceEvents', () => {
  it('écrit une entrée d’audit par événement nouveau, avec l’action correspondante', async () => {
    log('RESTORED 20261003T101500Z-pre-update-1.0.4 2026-10-03T10:30:00Z\nUPDATED 1.0.4 1.0.5 2026-10-03T10:40:00Z\nROLLED_BACK 1.0.5 1.0.4 migrate_failed 2026-10-03T10:50:00Z\n')
    expect(await recordInstanceEvents()).toBe(3)
    expect(auditLog.mock.calls.map(c => c[0])).toEqual(['INSTANCE_RESTORED', 'INSTANCE_UPDATED', 'INSTANCE_UPDATE_ROLLED_BACK'])
    expect(auditLog.mock.calls[2][1]).toMatchObject({ targetType: 'instance', details: { from: '1.0.5', to: '1.0.4', code: 'migrate_failed', at: '2026-10-03T10:50:00Z' } })
    expect(createMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true })
    expect(createMany.mock.calls[0][0].data).toHaveLength(3)
  })
  it('ne journalise pas deux fois un événement déjà connu', async () => {
    log('UPDATED 1.0.4 1.0.5 2026-10-03T10:40:00Z\nUPDATED 1.0.5 1.0.6 2026-10-04T10:40:00Z\n')
    findMany.mockResolvedValue([{ key: 'UPDATED 1.0.4 1.0.5 2026-10-03T10:40:00Z' }])
    expect(await recordInstanceEvents()).toBe(1)
    expect(auditLog).toHaveBeenCalledTimes(1)
  })
  it('sans fichier, fichier vide ou base indisponible : 0, sans lever', async () => {
    expect(await recordInstanceEvents()).toBe(0)
    log('UPDATED 1.0.4 1.0.5 2026-10-03T10:40:00Z\n'); findMany.mockRejectedValue(new Error('db down'))
    expect(await recordInstanceEvents()).toBe(0)
    expect(auditLog).not.toHaveBeenCalled()
  })
})
