// ─── Points de restauration avant mise à jour (PUR) — docs/specs/sauvegarde-rollback-spec.md, lot 1 ───
// `scripts/acra-snapshot.sh` crée et restaure les points ; l'application n'en lit que l'INDEX publié
// (`.acra-update/snapshots.json`) : identifiants validés, champs connus seulement, aucun chemin ni nom de base.

/** Même expression que `ID_RE` du script (un test de parité les compare). */
export const SNAPSHOT_ID_PATTERN = '^[0-9]{8}T[0-9]{6}Z-(pre-update|manual)-[0-9A-Za-z.+-]{1,40}$'
const ID_RE = new RegExp(SNAPSHOT_ID_PATTERN)

/** Tables dont le nombre de lignes est consigné au manifeste et recontrôlé à la restauration (parité avec le script). */
export const SNAPSHOT_COUNTED_TABLES = ['User', 'Organization', 'Analyse', 'Risque', 'PlanAction', 'AuditLog', 'Document', '_prisma_migrations'] as const

export const SNAPSHOT_INDEX_MAX_BYTES = 64 * 1024
const MAX_ENTRIES = 100

export type SnapshotReason = 'pre-update' | 'manual'
export type SnapshotVerification = 'full' | 'quick'
export interface SnapshotEntry {
  id: string; reason: SnapshotReason; createdAt: string; version: string; toVersion?: string
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
  if (o.reason !== 'pre-update' && o.reason !== 'manual') return null
  if (o.verified !== 'full' && o.verified !== 'quick') return null
  const createdAt = text(o.createdAt, 40); const version = text(o.version, 40)
  if (!createdAt || !version || !Number.isFinite(Date.parse(createdAt))) return null
  if (typeof o.sizeBytes !== 'number' || !Number.isFinite(o.sizeBytes) || o.sizeBytes < 0) return null
  const toVersion = text(o.toVersion, 40)
  return { id: o.id, reason: o.reason, createdAt, version, ...(toVersion ? { toVersion } : {}), verified: o.verified, clone: o.clone === true, documents: o.documents === true, encrypted: o.encrypted === true, sizeBytes: Math.floor(o.sizeBytes) }
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
