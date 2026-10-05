// #185 — bouton « Mettre à jour » d'une instance auto-hébergée : l'application
// dépose une DEMANDE (canal uniquement), un agent hôte l'exécute. Logique pure.
import { describe, expect, it } from 'vitest'
import { buildUpdateRequest, buildRollbackRequest, buildBackupPruneRequest, agentAlive, parseUpdateStatus, AGENT_MAX_AGE_MS } from '@/lib/update-request'

const now = new Date('2026-09-29T10:00:00Z')

describe('buildUpdateRequest', () => {
  it('ne contient que le canal, l’auteur et la date', () => {
    expect(buildUpdateRequest({ channel: 'stable', userId: 'u1', now, id: 'r1' }))
      .toEqual({ id: 'r1', action: 'update', channel: 'stable', requestedBy: 'u1', requestedAt: '2026-09-29T10:00:00.000Z' })
  })
  it('refuse tout canal inconnu', () => {
    expect(() => buildUpdateRequest({ channel: 'main && curl evil' as never, userId: 'u1', now, id: 'r1' })).toThrow()
  })
})

describe('agentAlive', () => {
  it('pulsation récente → agent actif ; absente, invalide ou trop ancienne → inactif', () => {
    expect(agentAlive({ at: '2026-09-29T09:58:00Z' }, now)).toBe(true)
    expect(agentAlive({ at: new Date(now.getTime() - AGENT_MAX_AGE_MS - 1000).toISOString() }, now)).toBe(false)
    expect(agentAlive(null, now)).toBe(false)
    expect(agentAlive({ at: 'n’importe quoi' }, now)).toBe(false)
  })
})

describe('parseUpdateStatus', () => {
  it('ne garde que des champs connus, bornés', () => {
    expect(parseUpdateStatus({ state: 'SUCCESS', channel: 'beta', version: '1.0.4-beta.1', message: 'x'.repeat(900), at: '2026-09-29T10:01:00Z', extra: 'ignoré' }))
      .toEqual({ state: 'SUCCESS', channel: 'beta', version: '1.0.4-beta.1', message: 'x'.repeat(500), at: '2026-09-29T10:01:00Z' })
  })
  it('état inconnu → null', () => {
    expect(parseUpdateStatus({ state: 'HACK' })).toBeNull()
    expect(parseUpdateStatus('texte')).toBeNull()
  })
})

describe('buildRollbackRequest (lot 3)', () => {
  const entry = { id: '20261003T101500Z-pre-update-1.0.4', reason: 'pre-update' as const, createdAt: '2026-10-03T10:15:00Z', version: '1.0.4', verified: 'full' as const, clone: true, documents: true, encrypted: false, sizeBytes: 1 }
  const index = { snapshots: [entry] }
  it('ne contient que l’action, l’identifiant du point, la version confirmée, l’auteur et la date', () => {
    expect(buildRollbackRequest({ snapshotId: entry.id, confirmVersion: '1.0.4', index, userId: 'u1', now, id: 'r2' }))
      .toEqual({ id: 'r2', action: 'rollback', snapshotId: entry.id, confirmVersion: '1.0.4', requestedBy: 'u1', requestedAt: '2026-09-29T10:00:00.000Z' })
  })
  it('refuse un identifiant invalide, inconnu de l’index, ou une version confirmée différente', () => {
    expect(() => buildRollbackRequest({ snapshotId: '../x', confirmVersion: '1.0.4', index, userId: 'u', now, id: 'r' })).toThrow('invalid_snapshot')
    expect(() => buildRollbackRequest({ snapshotId: '20261003T101500Z-manual-9', confirmVersion: '9', index, userId: 'u', now, id: 'r' })).toThrow('unknown_snapshot')
    expect(() => buildRollbackRequest({ snapshotId: entry.id, confirmVersion: '1.0.5', index, userId: 'u', now, id: 'r' })).toThrow('confirm_mismatch')
  })
})

describe('parseUpdateStatus — champs de la machine à états (lot 2)', () => {
  it('conserve étape, code, point, retour arrière et étapes ; ignore le reste', () => {
    const out = parseUpdateStatus({ state: 'FAILED', step: 'MIGRATE', code: 'migrate_failed', snapshotId: '20261003T101500Z-pre-update-1.0.4', from: '1.0.4', to: '1.0.5', rolledBack: true,
      steps: [{ step: 'PRECHECK', ok: true, at: '2026-10-03T10:00:00Z', x: 1 }, { step: 'HACK', ok: true, at: 'x' }], evil: 1 })
    expect(out).toMatchObject({ state: 'FAILED', step: 'MIGRATE', code: 'migrate_failed', from: '1.0.4', to: '1.0.5', rolledBack: true })
    expect(out?.snapshotId).toBe('20261003T101500Z-pre-update-1.0.4')
    expect(out?.steps).toEqual([{ step: 'PRECHECK', ok: true, at: '2026-10-03T10:00:00Z' }])
    expect(JSON.stringify(out)).not.toContain('evil')
  })
  it('un identifiant de point invalide ou un code inconnu est écarté', () => {
    const out = parseUpdateStatus({ state: 'FAILED', snapshotId: '../x', code: 'rm -rf' })
    expect(out?.snapshotId).toBeUndefined(); expect(out?.code).toBeUndefined()
  })
})

describe('parseUpdateStatus — precheck (lot 5)', () => {
  it('ne garde que des noms de migrations valides', () => {
    const out = parseUpdateStatus({ state: 'RUNNING', precheck: { destructive: ['20261004000000_drop_x', '../evil', 5] } })
    expect(out?.precheck).toEqual({ destructive: ['20261004000000_drop_x'] })
    expect(parseUpdateStatus({ state: 'RUNNING', precheck: { destructive: [] } })?.precheck).toBeUndefined()
  })
})

describe('buildBackupPruneRequest', () => {
  const mk = (day: number, over = {}) => ({ id: `202610${String(day).padStart(2, '0')}T020000Z-scheduled-1.0.4`, reason: 'scheduled' as const, createdAt: `2026-10-0${day}T02:00:00Z`, version: '1.0.4', verified: 'full' as const, clone: false, documents: true, encrypted: false, sizeBytes: 10, ...over })
  const index = { snapshots: [mk(5), mk(4), mk(3)] }
  const a = { userId: 'u', now: new Date('2026-10-05T00:00:00Z'), id: 'r1', index, protectedIds: [] as string[] }
  it('valide la liste : demande backup-prune avec uniquement les identifiants', () => {
    const r = buildBackupPruneRequest({ ...a, ids: [index.snapshots[1].id, index.snapshots[2].id] })
    expect(r).toEqual({ id: 'r1', action: 'backup-prune', ids: [index.snapshots[1].id, index.snapshots[2].id], requestedBy: 'u', requestedAt: '2026-10-05T00:00:00.000Z' })
  })
  it.each([
    ['no_ids', []], ['invalid_snapshot', ['../x']], ['unknown_snapshot', ['20250101T000000Z-manual-1.0.0']],
  ])('refuse %s', (code, ids) => expect(() => buildBackupPruneRequest({ ...a, ids })).toThrow(code))
  it('refuse le point protégé et les doublons sont dédoublonnés', () => {
    expect(() => buildBackupPruneRequest({ ...a, ids: [index.snapshots[0].id], protectedIds: [index.snapshots[0].id] })).toThrow('protected_snapshot')
    expect(buildBackupPruneRequest({ ...a, ids: [index.snapshots[1].id, index.snapshots[1].id] }).ids).toHaveLength(1)
  })
  it('refuse de supprimer le dernier point vérifié complet', () => {
    expect(() => buildBackupPruneRequest({ ...a, ids: index.snapshots.map(s => s.id) })).toThrow('last_verified_point')
  })
  it('borne à 50 identifiants', () => {
    const many = Array.from({ length: 60 }, (_, i) => mk(1, { id: `20261001T0200${String(i).padStart(2, '0')}Z-manual-v${i}`, reason: 'manual' }))
    expect(() => buildBackupPruneRequest({ ...a, index: { snapshots: [...many, mk(5)] }, ids: many.map(m => m.id) })).toThrow('too_many')
  })
})
