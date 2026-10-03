// Points de restauration (docs/specs/sauvegarde-rollback-spec.md, lot 1) : identifiant, index publié, tables comptées.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isSnapshotId, parseSnapshotIndex, SNAPSHOT_COUNTED_TABLES, SNAPSHOT_ID_PATTERN } from '@/lib/snapshot'

describe('isSnapshotId', () => {
  it.each(['20261003T101500Z-pre-update-1.0.4', '20261003T101500Z-manual-1.0.5-beta.1', '20261003T101500Z-pre-update-development'])('accepte %s', id => expect(isSnapshotId(id)).toBe(true))
  it.each(['../x', ';rm -rf /', '20261003T101500Z-other-1.0.4', '20261003T101500Z-pre-update-', '20261003T101500Z-pre-update-' + 'a'.repeat(41), 'x/20261003T101500Z-manual-1', '20261003T101500Z-manual-1.0\n', '', 12 as unknown as string])('refuse %s', id => expect(isSnapshotId(id)).toBe(false))
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
