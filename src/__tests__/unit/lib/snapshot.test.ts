// Points de restauration (docs/specs/sauvegarde-rollback-spec.md, lot 1) : identifiant, index publié, tables comptées.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isSnapshotId, parseSnapshotIndex, selectBackupsToPrune, SNAPSHOT_COUNTED_TABLES, SNAPSHOT_ID_PATTERN, type SnapshotEntry } from '@/lib/snapshot'

describe('isSnapshotId', () => {
  it.each(['20261003T101500Z-pre-update-1.0.4', '20261003T101500Z-manual-1.0.5-beta.1', '20261003T101500Z-pre-update-development'])('accepte %s', id => expect(isSnapshotId(id)).toBe(true))
  it.each(['../x', ';rm -rf /', '20261003T101500Z-other-1.0.4', '20261003T101500Z-pre-update-', '20261003T101500Z-pre-update-' + 'a'.repeat(41), 'x/20261003T101500Z-manual-1', '20261003T101500Z-manual-1.0\n', '', 12 as unknown as string])('refuse %s', id => expect(isSnapshotId(id)).toBe(false))
})

describe('points planifiés', () => {
  it('identifiant scheduled accepté ; tiers assainis', () => {
    expect(isSnapshotId('20261003T020000Z-scheduled-1.0.4')).toBe(true)
    const e = { id: '20261003T020000Z-scheduled-1.0.4', reason: 'scheduled', tiers: ['daily', 'weekly', 'hourly', 3], createdAt: '2026-10-03T02:00:00Z', version: '1.0.4', verified: 'quick', clone: false, documents: true, encrypted: false, sizeBytes: 1 }
    expect(parseSnapshotIndex({ schema: 1, snapshots: [e] }).snapshots[0]).toMatchObject({ reason: 'scheduled', tiers: ['daily', 'weekly'] })
  })
})

describe('parseSnapshotIndex', () => {
  const ok = { id: '20261003T101500Z-pre-update-1.0.4', reason: 'pre-update', createdAt: '2026-10-03T10:15:00Z', version: '1.0.4', toVersion: '1.0.5', verified: 'full', clone: true, documents: true, encrypted: false, sizeBytes: 123 }
  it('assainit : champs connus seulement, identifiant invalide écarté, textes bornés', () => {
    const idx = parseSnapshotIndex({ schema: 1, generatedAt: '2026-10-03T10:20:00Z', snapshots: [ok, { ...ok, id: '../etc' }, { ...ok, extra: 'x', path: '/secret' }] })
    expect(idx.snapshots).toHaveLength(2)
    expect(idx.snapshots[1]).toEqual(ok)
    expect(JSON.stringify(idx)).not.toContain('/secret')
  })
  it('refuse un schéma inconnu ou une entrée non conforme', () => {
    expect(parseSnapshotIndex({ schema: 2, snapshots: [ok] }).snapshots).toEqual([])
    expect(parseSnapshotIndex(null).snapshots).toEqual([])
    expect(parseSnapshotIndex({ schema: 1, snapshots: [{ ...ok, reason: 'hack' }, { ...ok, verified: 'maybe' }, { ...ok, sizeBytes: -1 }] }).snapshots).toEqual([])
  })
  it('ordonne du plus récent au plus ancien', () => {
    const a = { ...ok, id: '20261001T000000Z-pre-update-1.0.3', createdAt: '2026-10-01T00:00:00Z' }
    expect(parseSnapshotIndex({ schema: 1, snapshots: [a, ok] }).snapshots.map(s => s.id)).toEqual([ok.id, a.id])
  })
  it('borne le nombre d’entrées', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ ...ok, id: `20261003T1015${String(i % 60).padStart(2, '0')}Z-manual-v${i}` }))
    expect(parseSnapshotIndex({ schema: 1, snapshots: many }).snapshots.length).toBeLessThanOrEqual(100)
  })
})

describe('parité avec scripts/acra-snapshot.sh', () => {
  const script = readFileSync('scripts/acra-snapshot.sh', 'utf8')
  it('même expression d’identifiant', () => {
    const m = script.match(/^ID_RE='([^']+)'/m)
    expect(m?.[1]).toBe(SNAPSHOT_ID_PATTERN)
  })
  it('mêmes tables comptées', () => {
    const m = script.match(/^COUNTED_TABLES="([^"]+)"/m)
    expect(m?.[1].split(' ')).toEqual([...SNAPSHOT_COUNTED_TABLES])
  })
})

describe('selectBackupsToPrune — libérer de l’espace en gardant les N plus récentes', () => {
  const e = (day: number, reason: SnapshotEntry['reason'], over: Partial<SnapshotEntry> = {}): SnapshotEntry => ({
    id: `202610${String(day).padStart(2, '0')}T020000Z-${reason}-1.0.4`, reason, createdAt: `2026-10-${String(day).padStart(2, '0')}T02:00:00Z`,
    version: '1.0.4', verified: 'full', clone: false, documents: true, encrypted: false, sizeBytes: 100, ...over,
  })
  const base = { keepScheduled: 2, keepPreUpdate: 1, keepManual: 1, includeManual: false, protectedIds: [] as string[] }
  const idx = { snapshots: [e(9, 'scheduled'), e(8, 'scheduled'), e(7, 'scheduled'), e(6, 'scheduled'), e(5, 'pre-update'), e(4, 'pre-update'), e(3, 'manual'), e(2, 'manual')] }
  const del = (r: ReturnType<typeof selectBackupsToPrune>) => r.toDelete.map(x => x.id.slice(0, 8)).sort()

  it('garde les N plus récentes par type ; manuels intacts par défaut', () => {
    const r = selectBackupsToPrune(idx, base)
    expect(del(r)).toEqual(['20261004', '20261006', '20261007'])
    expect(r.reclaimedBytes).toBe(300)
    expect(r.toKeep).toHaveLength(5)
  })
  it('manuels inclus : N le plus récents gardés', () => {
    expect(del(selectBackupsToPrune(idx, { ...base, includeManual: true }))).toEqual(['20261002', '20261004', '20261006', '20261007'])
  })
  it('le point protégé (mise à jour en cours) n’est jamais supprimé', () => {
    const r = selectBackupsToPrune(idx, { ...base, protectedIds: [idx.snapshots[3].id] })
    expect(del(r)).toEqual(['20261004', '20261007'])
  })
  it('conserve toujours au moins un point vérifié complet', () => {
    const quick = { snapshots: [e(9, 'scheduled', { verified: 'quick' }), e(8, 'scheduled', { verified: 'quick' }), e(7, 'scheduled') ] }
    const r = selectBackupsToPrune(quick, { ...base, keepScheduled: 1 })
    expect(r.toKeep.some(x => x.verified === 'full')).toBe(true)
    expect(del(r)).toEqual(['20261008'])
  })
  it('N hors de 1–60 ou non entier : keep_min_1', () => {
    for (const bad of [0, -1, 61, 1.5, NaN]) expect(() => selectBackupsToPrune(idx, { ...base, keepScheduled: bad })).toThrow('keep_min_1')
  })
  it('index vide : rien à faire', () => {
    expect(selectBackupsToPrune({ snapshots: [] }, base)).toEqual({ toDelete: [], toKeep: [], reclaimedBytes: 0 })
  })
})
