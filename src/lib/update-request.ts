// ─── Mise à jour d'une instance auto-hébergée depuis l'interface (#185) — PUR ─
// L'application ne lance JAMAIS de commande système : elle dépose une demande
// (canal stable ou bêta, rien d'autre) dans `.acra-update/inbox/`, qu'un agent
// hôte (`scripts/update-agent.sh`, planifié par cron) exécute via `scripts/update.sh`.
// L'agent publie sa pulsation (`agent.json`) et l'avancement (`status.json`).

import { isUpdateChannel, type UpdateChannel } from '@/lib/version-check'
import { isSnapshotId, type SnapshotIndex } from '@/lib/snapshot'
import { UPDATE_STATES, type UpdateRunState } from '@/lib/update-run'
import { validateBackupPolicy, type BackupPolicy } from '@/lib/backup-policy'

/** Au-delà de ce délai sans pulsation, l'agent est considéré absent. */
export const AGENT_MAX_AGE_MS = 5 * 60 * 1000

export type UpdateRequestUpdate = { id: string; action: 'update'; channel: UpdateChannel; requestedBy: string; requestedAt: string }
export type UpdateRequestRollback = { id: string; action: 'rollback'; snapshotId: string; confirmVersion: string; requestedBy: string; requestedAt: string }
export type UpdateRequestBackupPolicy = { id: string; action: 'backup-policy'; policy: BackupPolicy; requestedBy: string; requestedAt: string }
export type UpdateRequestBackupPrune = { id: string; action: 'backup-prune'; ids: string[]; requestedBy: string; requestedAt: string }
export type UpdateRequest = UpdateRequestUpdate | UpdateRequestRollback | UpdateRequestBackupPolicy | UpdateRequestBackupPrune
export type UpdateState = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
export interface UpdateStatusStep { step: string; ok: boolean; at: string }
export interface UpdateStatus {
  state: UpdateState; channel?: UpdateChannel; version?: string; message?: string; at?: string
  precheck?: { destructive: string[] }
  step?: UpdateRunState; code?: string; snapshotId?: string; from?: string; to?: string; rolledBack?: boolean; steps?: UpdateStatusStep[]
}

/** Demande de mise à jour : canal validé + traçabilité. Lève si le canal est inconnu. */
export function buildUpdateRequest(a: { channel: UpdateChannel; userId: string; now: Date; id: string }): UpdateRequestUpdate {
  if (!isUpdateChannel(a.channel)) throw new Error('invalid_channel')
  return { id: a.id, action: 'update', channel: a.channel, requestedBy: a.userId, requestedAt: a.now.toISOString() }
}

/** Demande de retour à un point de restauration : le point doit figurer dans l'index publié et la version être confirmée. */
export function buildRollbackRequest(a: { snapshotId: string; confirmVersion: string; index: SnapshotIndex; userId: string; now: Date; id: string }): UpdateRequestRollback {
  if (!isSnapshotId(a.snapshotId)) throw new Error('invalid_snapshot')
  const entry = a.index.snapshots.find(e => e.id === a.snapshotId)
  if (!entry) throw new Error('unknown_snapshot')
  if (typeof a.confirmVersion !== 'string' || a.confirmVersion.trim() !== entry.version) throw new Error('confirm_mismatch')
  return { id: a.id, action: 'rollback', snapshotId: entry.id, confirmVersion: entry.version, requestedBy: a.userId, requestedAt: a.now.toISOString() }
}

/** Demande de nouvelle politique de sauvegarde : validée, et réduite aux seuls champs connus. Lève `invalid_policy`. */
export function buildBackupPolicyRequest(a: { policy: unknown; userId: string; now: Date; id: string }): UpdateRequestBackupPolicy {
  if (!validateBackupPolicy(a.policy).ok) throw new Error('invalid_policy')
  const p = a.policy as BackupPolicy
  const policy: BackupPolicy = {
    daily: { enabled: p.daily.enabled, keep: p.daily.keep },
    weekly: { enabled: p.weekly.enabled, keep: p.weekly.keep, weekday: p.weekly.weekday },
    monthly: { enabled: p.monthly.enabled, keep: p.monthly.keep, day: p.monthly.day },
    hour: p.hour,
  }
  return { id: a.id, action: 'backup-policy', policy, requestedBy: a.userId, requestedAt: a.now.toISOString() }
}

export const PRUNE_MAX_IDS = 50

/**
 * Demande de suppression de points : liste EXACTE d'identifiants (validés dans l'aperçu), tous présents dans l'index publié,
 * jamais le point protégé, et jamais le dernier point vérifié complet. Lève invalid_snapshot, no_ids, too_many,
 * unknown_snapshot, protected_snapshot ou last_verified_point.
 */
export function buildBackupPruneRequest(a: { ids: string[]; index: SnapshotIndex; protectedIds: string[]; userId: string; now: Date; id: string }): UpdateRequestBackupPrune {
  if (!Array.isArray(a.ids) || a.ids.length === 0) throw new Error('no_ids')
  if (!a.ids.every(isSnapshotId)) throw new Error('invalid_snapshot')
  const ids = [...new Set(a.ids)]
  if (ids.length > PRUNE_MAX_IDS) throw new Error('too_many')
  const byId = new Map(a.index.snapshots.map(e => [e.id, e]))
  for (const id of ids) {
    if (!byId.has(id)) throw new Error('unknown_snapshot')
    if (a.protectedIds.includes(id)) throw new Error('protected_snapshot')
  }
  if (!a.index.snapshots.some(e => e.verified === 'full' && !ids.includes(e.id))) throw new Error('last_verified_point')
  return { id: a.id, action: 'backup-prune', ids, requestedBy: a.userId, requestedAt: a.now.toISOString() }
}

/** L'agent hôte a-t-il publié une pulsation récente ? */
export function agentAlive(heartbeat: unknown, now: Date, maxAgeMs = AGENT_MAX_AGE_MS): boolean {
  const at = heartbeat && typeof heartbeat === 'object' ? Date.parse(String((heartbeat as { at?: unknown }).at)) : NaN
  return Number.isFinite(at) && now.getTime() - at <= maxAgeMs && at <= now.getTime() + 60_000
}

const STATES: readonly UpdateState[] = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']
const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined)

/** Statut publié par l'agent, assaini (champs connus, textes bornés) ; invalide → null. */
export function parseUpdateStatus(raw: unknown): UpdateStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!STATES.includes(o.state as UpdateState)) return null
  const out: UpdateStatus = { state: o.state as UpdateState }
  if (isUpdateChannel(o.channel)) out.channel = o.channel
  const version = str(o.version, 40); if (version) out.version = version
  const message = str(o.message, 500); if (message) out.message = message
  const at = str(o.at, 40); if (at) out.at = at
  const ALL: readonly string[] = [...UPDATE_STATES, 'ROLLBACK', 'ROLLED_BACK', 'ROLLBACK_FAILED']
  if (typeof o.step === 'string' && ALL.includes(o.step)) out.step = o.step as UpdateRunState
  if (typeof o.code === 'string' && /^[A-Za-z_]{1,40}$/.test(o.code)) out.code = o.code
  if (isSnapshotId(o.snapshotId)) out.snapshotId = o.snapshotId
  const from = str(o.from, 40); if (from) out.from = from
  const to = str(o.to, 40); if (to) out.to = to
  if (typeof o.rolledBack === 'boolean') out.rolledBack = o.rolledBack
  const pre = o.precheck as { destructive?: unknown } | undefined
  if (pre && Array.isArray(pre.destructive)) {
    const d = pre.destructive.filter((x): x is string => typeof x === 'string' && /^\d{14}_[A-Za-z0-9_]{1,100}$/.test(x)).slice(0, 20)
    if (d.length) out.precheck = { destructive: d }
  }
  if (Array.isArray(o.steps)) {
    out.steps = o.steps.slice(-20).flatMap((x): UpdateStatusStep[] => {
      if (!x || typeof x !== 'object') return []
      const r = x as Record<string, unknown>
      const sat = str(r.at, 40)
      return typeof r.step === 'string' && ALL.includes(r.step) && typeof r.ok === 'boolean' && sat ? [{ step: r.step, ok: r.ok, at: sat }] : []
    })
  }
  return out
}
