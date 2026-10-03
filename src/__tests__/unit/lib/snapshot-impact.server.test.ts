// @vitest-environment node
// Impact d'un retour à un point de restauration : saisies postérieures qui seraient perdues.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const auditCount = vi.fn(); const docCount = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { auditLog: { count: (...a: unknown[]) => auditCount(...a) }, document: { count: (...a: unknown[]) => docCount(...a) } } }))

import { snapshotImpacts, failedDbRetentionDays } from '@/lib/snapshot-impact.server'

const e = (id: string, createdAt: string) => ({ id, reason: 'pre-update' as const, createdAt, version: '1.0.4', verified: 'full' as const, clone: true, documents: true, encrypted: false, sizeBytes: 1 })
beforeEach(() => { vi.clearAllMocks(); auditCount.mockResolvedValue(12); docCount.mockResolvedValue(3) })

describe('snapshotImpacts', () => {
  it('compte les entrées d’audit et documents créés après chaque point', async () => {
    const r = await snapshotImpacts([e('20261003T101500Z-pre-update-1.0.4', '2026-10-03T10:15:00Z')])
    expect(r['20261003T101500Z-pre-update-1.0.4']).toEqual({ auditEntries: 12, documents: 3 })
    expect(auditCount.mock.calls[0][0]).toEqual({ where: { createdAt: { gt: new Date('2026-10-03T10:15:00Z') } } })
    expect(docCount.mock.calls[0][0]).toEqual({ where: { createdAt: { gt: new Date('2026-10-03T10:15:00Z') } } })
  })
  it('borne le nombre de points calculés et ne lève pas si la base échoue', async () => {
    const many = Array.from({ length: 50 }, (_, i) => e(`20261003T1015${String(i).padStart(2, '0')}Z-manual-v${i}`, '2026-10-03T10:15:00Z'))
    await snapshotImpacts(many)
    expect(auditCount.mock.calls.length).toBeLessThanOrEqual(10)
    auditCount.mockRejectedValue(new Error('db'))
    expect(await snapshotImpacts([e('20261003T101500Z-pre-update-1.0.4', '2026-10-03T10:15:00Z')])).toEqual({})
  })
})

describe('failedDbRetentionDays', () => {
  it('défaut 14 ; valeur de l’environnement bornée', () => {
    expect(failedDbRetentionDays({})).toBe(14)
    expect(failedDbRetentionDays({ ACRA_FAILED_DB_RETENTION_DAYS: '30' })).toBe(30)
    expect(failedDbRetentionDays({ ACRA_FAILED_DB_RETENTION_DAYS: 'abc' })).toBe(14)
    expect(failedDbRetentionDays({ ACRA_FAILED_DB_RETENTION_DAYS: '-5' })).toBe(14)
  })
})
