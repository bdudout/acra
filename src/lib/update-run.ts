// ─── Machine à états de la mise à jour (PUR) — docs/specs/sauvegarde-rollback-spec.md, lot 2 ───
// Table normative : que faire si une étape échoue, quand restaurer la base, comment reprendre après une interruption.
// Les scripts (update.sh / update-steps.sh) appliquent cette table ; l'application lit seulement le journal et le statut.

import { isSnapshotId } from '@/lib/snapshot'

export const UPDATE_STATES = ['PRECHECK', 'QUIESCE', 'SNAPSHOT', 'FETCH', 'HANDOFF', 'MIGRATE', 'START', 'HEALTH', 'SMOKE', 'FINALIZE', 'DONE'] as const
export type UpdateStep = (typeof UPDATE_STATES)[number]
export type UpdateRunState = UpdateStep | 'ROLLBACK' | 'ROLLED_BACK' | 'ROLLBACK_FAILED'
const ALL_STATES: readonly string[] = [...UPDATE_STATES, 'ROLLBACK', 'ROLLED_BACK', 'ROLLBACK_FAILED']

/** Codes d'erreur publiés dans le statut (l'application les traduit : `admin.version.updateCodes.*`). */
export const UPDATE_ERROR_CODES = [
  'precheck_failed', 'precheck_dirty', 'precheck_fetch', 'precheck_branch', 'precheck_same', 'precheck_not_ff', 'precheck_space', 'precheck_no_stop_cmd', 'precheck_busy',
  'quiesce_failed', 'snapshot_failed', 'snapshot_space', 'fetch_failed', 'handoff_failed', 'migrate_failed', 'start_failed', 'health_failed', 'smoke_failed', 'finalize_failed',
  'interrupted_before_snapshot', 'rollback_not_ancestor', 'rollback_failed', 'invalid_request',
] as const
export type UpdateErrorCode = (typeof UPDATE_ERROR_CODES)[number]

export type FailureAction = 'ABORT_UNTOUCHED' | 'RESTART_OLD' | 'RESET_CODE_AND_RESTART' | 'ROLLBACK' | 'LOG_ONLY'

const ON_FAILURE: Record<Exclude<UpdateStep, 'DONE'>, { action: FailureAction; code: UpdateErrorCode }> = {
  PRECHECK: { action: 'ABORT_UNTOUCHED', code: 'precheck_failed' },
  QUIESCE: { action: 'RESTART_OLD', code: 'quiesce_failed' },
  SNAPSHOT: { action: 'RESTART_OLD', code: 'snapshot_failed' },
  FETCH: { action: 'RESET_CODE_AND_RESTART', code: 'fetch_failed' },
  HANDOFF: { action: 'ROLLBACK', code: 'handoff_failed' },
  MIGRATE: { action: 'ROLLBACK', code: 'migrate_failed' },
  START: { action: 'ROLLBACK', code: 'start_failed' },
  HEALTH: { action: 'ROLLBACK', code: 'health_failed' },
  SMOKE: { action: 'ROLLBACK', code: 'smoke_failed' },
  FINALIZE: { action: 'LOG_ONLY', code: 'finalize_failed' },
}

export function nextOnFailure(state: Exclude<UpdateStep, 'DONE'>): { action: FailureAction; code: UpdateErrorCode } {
  return ON_FAILURE[state]
}

/** La base n'est restaurée que si la migration a pu commencer : avant, elle est intacte. */
export function needsDbRestore(state: UpdateRunState): boolean {
  return state === 'MIGRATE' || state === 'START' || state === 'HEALTH' || state === 'SMOKE'
}

export type ResumeAction = 'RESTART_AND_FAIL' | 'RESTART_CLEAN_SNAPSHOT_AND_FAIL' | 'ROLLBACK' | 'REPLAY_ROLLBACK' | 'FINALIZE' | 'NONE'

/** Reprise après interruption (kill, redémarrage de l'hôte) : on ne sait pas si la migration a été partiellement appliquée. */
export function resumeAction(state: UpdateRunState): ResumeAction {
  switch (state) {
    case 'PRECHECK': case 'QUIESCE': return 'RESTART_AND_FAIL'
    case 'SNAPSHOT': return 'RESTART_CLEAN_SNAPSHOT_AND_FAIL'
    case 'FETCH': case 'HANDOFF': case 'MIGRATE': case 'START': case 'HEALTH': case 'SMOKE': return 'ROLLBACK'
    case 'ROLLBACK': return 'REPLAY_ROLLBACK'
    case 'FINALIZE': case 'DONE': return 'FINALIZE'
    default: return 'NONE'
  }
}

export interface RunStep { state: UpdateRunState; ok: boolean; at: string; code: string | null }
export interface RunJournal {
  runId: string; kind: 'update' | 'rollback'; channel?: string
  from: { version: string; sha: string }; to: { version: string; sha: string }
  snapshotId: string | null; state: UpdateRunState; startedAt: string; updatedAt: string; steps: RunStep[]
}

const MAX_STEPS = 50
const text = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined)
const ver = (v: unknown): { version: string; sha: string } | null => {
  if (!v || typeof v !== 'object') return null
  const o = v as { version?: unknown; sha?: unknown }
  const version = text(o.version, 40); const sha = text(o.sha, 64)
  return version && sha && /^[0-9a-f]{7,64}$/.test(sha) ? { version, sha } : null
}

/** `.acra-update/run/current.json` / `last.json`, assaini ; invalide → null. */
export function parseRunJournal(raw: unknown): RunJournal | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.schema !== 1) return null
  if (o.kind !== 'update' && o.kind !== 'rollback') return null
  if (typeof o.state !== 'string' || !ALL_STATES.includes(o.state)) return null
  if (o.snapshotId !== null && o.snapshotId !== undefined && !isSnapshotId(o.snapshotId)) return null
  const from = ver(o.from); const to = ver(o.to)
  const runId = text(o.runId, 64); const startedAt = text(o.startedAt, 40); const updatedAt = text(o.updatedAt, 40)
  if (!from || !to || !runId || !startedAt || !updatedAt) return null
  const steps: RunStep[] = (Array.isArray(o.steps) ? o.steps : []).slice(-MAX_STEPS).flatMap((s): RunStep[] => {
    if (!s || typeof s !== 'object') return []
    const st = s as Record<string, unknown>
    const at = text(st.at, 40)
    if (typeof st.state !== 'string' || !ALL_STATES.includes(st.state) || typeof st.ok !== 'boolean' || !at) return []
    return [{ state: st.state as UpdateRunState, ok: st.ok, at, code: text(st.code, 60) ?? null }]
  })
  const channel = text(o.channel, 20)
  return { runId, kind: o.kind, ...(channel ? { channel } : {}), from, to, snapshotId: (o.snapshotId as string | null | undefined) ?? null, state: o.state as UpdateRunState, startedAt, updatedAt, steps }
}
