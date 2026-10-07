// ─── Points de restauration avant mise à jour (PUR) — docs/specs/sauvegarde-rollback-spec.md, lot 1 ───
// `scripts/acra-snapshot.sh` crée et restaure les points ; l'application n'en lit que l'INDEX publié
// (`.acra-update/snapshots.json`) : identifiants validés, champs connus seulement, aucun chemin ni nom de base.

/** Même expression que `ID_RE` du script (un test de parité les compare). */
export const SNAPSHOT_ID_PATTERN = '^[0-9]{8}T[0-9]{6}Z-(pre-update|manual|scheduled)-[0-9A-Za-z.+-]{1,40}$'
const ID_RE = new RegExp(SNAPSHOT_ID_PATTERN)

/** Tables dont le nombre de lignes est consigné au manifeste et recontrôlé à la restauration (parité avec le script). */
export const SNAPSHOT_COUNTED_TABLES = ['User', 'Organization', 'Analyse', 'Risque', 'PlanAction', 'AuditLog', 'Document', '_prisma_migrations'] as const

export const SNAPSHOT_INDEX_MAX_BYTES = 64 * 1024
const MAX_ENTRIES = 100

export type SnapshotReason = 'pre-update' | 'manual' | 'scheduled'
export type SnapshotTier = 'daily' | 'weekly' | 'monthly'
export type SnapshotVerification = 'full' | 'quick'
export interface SnapshotEntry {
  id: string; reason: SnapshotReason; createdAt: string; version: string; toVersion?: string
  tiers?: SnapshotTier[]
  verified: SnapshotVerification; clone: boolean; documents: boolean; encrypted: boolean; sizeBytes: number
}
export interface SnapshotIndex { generatedAt?: string; snapshots: SnapshotEntry[] }

export function isSnapshotId(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 80 && ID_RE.test(v) && !v.includes('\n')
}

const text = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined)

function parseEntry(raw: unknown): SnapshotEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isSnapshotId(o.id)) return null
  if (o.reason !== 'pre-update' && o.reason !== 'manual' && o.reason !== 'scheduled') return null
  if (o.verified !== 'full' && o.verified !== 'quick') return null
  const createdAt = text(o.createdAt, 40); const version = text(o.version, 40)
  if (!createdAt || !version || !Number.isFinite(Date.parse(createdAt))) return null
  if (typeof o.sizeBytes !== 'number' || !Number.isFinite(o.sizeBytes) || o.sizeBytes < 0) return null
  const toVersion = text(o.toVersion, 40)
  const tiers = Array.isArray(o.tiers) ? o.tiers.filter((t): t is SnapshotTier => t === 'daily' || t === 'weekly' || t === 'monthly') : []
  return { id: o.id, reason: o.reason, createdAt, version, ...(toVersion ? { toVersion } : {}), ...(tiers.length ? { tiers } : {}), verified: o.verified, clone: o.clone === true, documents: o.documents === true, encrypted: o.encrypted === true, sizeBytes: Math.floor(o.sizeBytes) }
}

/** Index publié par le script, assaini ; schéma inconnu ou entrée invalide → écartés. Plus récent d'abord. */
export function parseSnapshotIndex(raw: unknown): SnapshotIndex {
  if (!raw || typeof raw !== 'object') return { snapshots: [] }
  const o = raw as { schema?: unknown; generatedAt?: unknown; snapshots?: unknown }
  if (o.schema !== 1 || !Array.isArray(o.snapshots)) return { snapshots: [] }
  const snapshots = o.snapshots.map(parseEntry).filter((e): e is SnapshotEntry => e !== null)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_ENTRIES)
  const generatedAt = text(o.generatedAt, 40)
  return { ...(generatedAt ? { generatedAt } : {}), snapshots }
}

// ─── Libération d'espace : suppression des points au-delà des N plus récents ───

export interface PruneOptions { keepScheduled: number; keepPreUpdate: number; keepManual: number; includeManual: boolean; protectedIds: string[] }
export interface PruneSelection { toDelete: SnapshotEntry[]; toKeep: SnapshotEntry[]; reclaimedBytes: number }
export const PRUNE_KEEP_MAX = 60

/**
 * Miroir de `acra-snapshot.sh prune` pour l'aperçu : N plus récents gardés par type (les points manuels ne sont concernés
 * qu'avec `includeManual`), point protégé (mise à jour en cours) jamais supprimé, et au moins un point vérifié « full »
 * toujours conservé. Lève `keep_min_1` si un N n'est pas un entier de 1 à 60.
 */
export function selectBackupsToPrune(index: SnapshotIndex, o: PruneOptions): PruneSelection {
  for (const n of [o.keepScheduled, o.keepPreUpdate, o.keepManual]) if (!Number.isInteger(n) || n < 1 || n > PRUNE_KEEP_MAX) throw new Error('keep_min_1')
  const sorted = [...index.snapshots].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const limits: Record<SnapshotReason, number> = { scheduled: o.keepScheduled, 'pre-update': o.keepPreUpdate, manual: o.includeManual ? o.keepManual : Infinity }
  const seen: Record<SnapshotReason, number> = { scheduled: 0, 'pre-update': 0, manual: 0 }
  let toDelete: SnapshotEntry[] = []; const toKeep: SnapshotEntry[] = []
  for (const e of sorted) {
    seen[e.reason] += 1
    if (o.protectedIds.includes(e.id) || seen[e.reason] <= limits[e.reason]) toKeep.push(e); else toDelete.push(e)
  }
  if (!toKeep.some(e => e.verified === 'full')) {
    const rescue = toDelete.find(e => e.verified === 'full')
    if (rescue) { toDelete = toDelete.filter(e => e !== rescue); toKeep.push(rescue) }
  }
  return { toDelete, toKeep, reclaimedBytes: toDelete.reduce((n, e) => n + e.sizeBytes, 0) }
}
