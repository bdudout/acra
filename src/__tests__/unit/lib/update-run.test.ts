// Machine à états de la mise à jour (docs/specs/sauvegarde-rollback-spec.md, lot 2) : table normative d'échec, reprise, journal.
import { describe, it, expect } from 'vitest'
import { UPDATE_STATES, UPDATE_ERROR_CODES, nextOnFailure, needsDbRestore, resumeAction, parseRunJournal, type UpdateRunState } from '@/lib/update-run'

describe('nextOnFailure (table 2.1)', () => {
  it.each([
    ['PRECHECK', 'ABORT_UNTOUCHED', 'precheck_failed'],
    ['QUIESCE', 'RESTART_OLD', 'quiesce_failed'],
    ['SNAPSHOT', 'RESTART_OLD', 'snapshot_failed'],
    ['FETCH', 'RESET_CODE_AND_RESTART', 'fetch_failed'],
    ['HANDOFF', 'ROLLBACK', 'handoff_failed'],
    ['MIGRATE', 'ROLLBACK', 'migrate_failed'],
    ['START', 'ROLLBACK', 'start_failed'],
    ['HEALTH', 'ROLLBACK', 'health_failed'],
    ['SMOKE', 'ROLLBACK', 'smoke_failed'],
    ['FINALIZE', 'LOG_ONLY', 'finalize_failed'],
  ] as const)('%s ⇒ %s (%s)', (state, action, code) => {
    expect(nextOnFailure(state)).toEqual({ action, code })
  })
  it('tous les codes publiés sont déclarés pour l’i18n', () => {
    for (const s of UPDATE_STATES.filter(s => s !== 'DONE')) expect(UPDATE_ERROR_CODES).toContain(nextOnFailure(s as Exclude<UpdateRunState, 'DONE'>).code)
  })
})

describe('needsDbRestore', () => {
  it('la base n’est restaurée que si la migration a pu commencer', () => {
    const yes = UPDATE_STATES.filter(s => needsDbRestore(s))
    expect(yes).toEqual(['MIGRATE', 'START', 'HEALTH', 'SMOKE'])
    expect(needsDbRestore('HANDOFF')).toBe(false)
    expect(needsDbRestore('ROLLBACK')).toBe(false)
  })
})

describe('resumeAction (2.2)', () => {
  it.each([
    ['PRECHECK', 'RESTART_AND_FAIL'], ['QUIESCE', 'RESTART_AND_FAIL'], ['SNAPSHOT', 'RESTART_CLEAN_SNAPSHOT_AND_FAIL'],
    ['FETCH', 'ROLLBACK'], ['HANDOFF', 'ROLLBACK'], ['MIGRATE', 'ROLLBACK'], ['START', 'ROLLBACK'], ['HEALTH', 'ROLLBACK'], ['SMOKE', 'ROLLBACK'],
    ['ROLLBACK', 'REPLAY_ROLLBACK'], ['FINALIZE', 'FINALIZE'], ['DONE', 'FINALIZE'], ['ROLLED_BACK', 'NONE'], ['ROLLBACK_FAILED', 'NONE'],
  ] as const)('%s ⇒ %s', (state, action) => expect(resumeAction(state)).toBe(action))
})

describe('parseRunJournal', () => {
  const ok = { schema: 1, runId: 'r1', kind: 'update', channel: 'stable', from: { version: '1.0.4', sha: 'a'.repeat(40) }, to: { version: '1.0.5', sha: 'b'.repeat(40) }, snapshotId: '20261003T101500Z-pre-update-1.0.4', state: 'MIGRATE', startedAt: '2026-10-03T10:15:00Z', updatedAt: '2026-10-03T10:16:00Z', steps: [{ state: 'PRECHECK', ok: true, at: '2026-10-03T10:15:01Z', code: null }] }
  it('lit un journal valide', () => {
    const j = parseRunJournal(ok)
    expect(j).toMatchObject({ runId: 'r1', kind: 'update', state: 'MIGRATE', snapshotId: ok.snapshotId })
    expect(j?.steps).toHaveLength(1)
  })
  it('refuse un schéma, un état ou un identifiant de point invalide', () => {
    expect(parseRunJournal({ ...ok, schema: 2 })).toBeNull()
    expect(parseRunJournal({ ...ok, state: 'HACK' })).toBeNull()
    expect(parseRunJournal({ ...ok, snapshotId: '../x' })).toBeNull()
    expect(parseRunJournal(null)).toBeNull()
    expect(parseRunJournal('x')).toBeNull()
  })
  it('accepte snapshotId nul (avant le point de restauration) et borne les étapes', () => {
    expect(parseRunJournal({ ...ok, snapshotId: null, state: 'QUIESCE' })?.snapshotId).toBeNull()
    expect(parseRunJournal({ ...ok, steps: Array.from({ length: 500 }, () => ok.steps[0]) })?.steps.length).toBeLessThanOrEqual(50)
  })
  it('un retour arrière manuel est un journal de nature rollback', () => {
    expect(parseRunJournal({ ...ok, kind: 'rollback' })?.kind).toBe('rollback')
    expect(parseRunJournal({ ...ok, kind: 'x' })).toBeNull()
  })
})
