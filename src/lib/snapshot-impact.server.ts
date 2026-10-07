// ─── Impact d'un retour à un point de restauration — affiché dans le dialogue de confirmation ───
// Ce que la restauration ferait perdre : entrées du journal d'audit et documents créés APRÈS le point.
// Calcul à la volée sur la base courante, borné aux points les plus récents ; ne lève jamais.

import { prisma } from '@/lib/prisma'
import type { SnapshotEntry } from '@/lib/snapshot'

export interface SnapshotImpact { auditEntries: number; documents: number }
const MAX_POINTS = 10

export async function snapshotImpacts(entries: readonly SnapshotEntry[]): Promise<Record<string, SnapshotImpact>> {
  const out: Record<string, SnapshotImpact> = {}
  try {
    for (const s of entries.slice(0, MAX_POINTS)) {
      const since = new Date(s.createdAt)
      const where = { createdAt: { gt: since } }
      const [auditEntries, documents] = await Promise.all([prisma.auditLog.count({ where }), prisma.document.count({ where })])
      out[s.id] = { auditEntries, documents }
    }
  } catch { return {} }
  return out
}

/** Durée de conservation de la base écrasée (`__failed_`) : même variable que scripts/acra-snapshot.sh (défaut 14 jours). */
export function failedDbRetentionDays(env: Record<string, string | undefined>): number {
  const n = Number(env.ACRA_FAILED_DB_RETENTION_DAYS)
  return Number.isInteger(n) && n > 0 && n <= 365 ? n : 14
}
