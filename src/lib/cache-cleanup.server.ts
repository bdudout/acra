// ─── Nettoyage du cache sans impact : exécution (aperçu, suppression par lots, verrou) ───
// Le client Prisma est injecté (testable sans base). Les filtres viennent de `cache-cleanup.ts` (pur).

import { planCleanup, type CleanupId } from '@/lib/cache-cleanup'

interface Delegate {
  count(a: { where: unknown }): Promise<number>
  findMany(a: { where: unknown; select: Record<string, true>; take: number }): Promise<Array<Record<string, string>>>
  deleteMany(a: { where: Record<string, { in: string[] }> }): Promise<{ count: number }>
}
export type CleanupDb = Record<'passwordResetToken' | 'verificationToken' | 'mfaChallenge' | 'session' | 'trustedDevice' | 'orgInvitation' | 'webhookDelivery' | 'analysisImport', Delegate> & {
  configuration: { updateMany(a: { where: unknown; data: unknown }): Promise<{ count: number }> }
}

export interface CleanupPreviewRow { id: CleanupId; count: number; bytes: number }
export type CleanupRunResult = { ok: true; counts: Partial<Record<CleanupId, number>> } | { ok: false; error: 'already_running' }

/** Bail d'exécution : une seule exécution à la fois ; il expire seul (crash) au bout de 10 minutes. */
const LEASE_MS = 10 * 60_000

export async function previewCleanup(db: CleanupDb, now: Date, categories?: CleanupId[]): Promise<CleanupPreviewRow[]> {
  const rows: CleanupPreviewRow[] = []
  for (const p of planCleanup(now, categories)) {
    const count = await db[p.model].count({ where: p.where })
    rows.push({ id: p.id, count, bytes: count * p.avgRowBytes })
  }
  return rows
}

/** Suppression par lots d'identifiants (aucun verrou long sur une grosse table). Bail d'exécution : `already_running` s'il est pris. */
export async function runCleanup(db: CleanupDb, now: Date, categories?: CleanupId[], opts: { batchSize?: number } = {}): Promise<CleanupRunResult> {
  const batch = Math.max(1, Math.min(5000, opts.batchSize ?? 1000))
  const lease = await db.configuration.updateMany({ where: { id: 'global', OR: [{ cleanupLockUntil: null }, { cleanupLockUntil: { lt: now } }] }, data: { cleanupLockUntil: new Date(now.getTime() + LEASE_MS) } })
  if (lease.count === 0) return { ok: false, error: 'already_running' }
  try {
    const counts: Partial<Record<CleanupId, number>> = {}
    for (const p of planCleanup(now, categories)) {
      let total = 0
      for (;;) {
        const rows = await db[p.model].findMany({ where: p.where, select: { [p.idField]: true }, take: batch })
        if (rows.length === 0) break
        const ids = rows.map(r => r[p.idField])
        total += (await db[p.model].deleteMany({ where: { [p.idField]: { in: ids } } })).count
        if (rows.length < batch) break
      }
      counts[p.id] = total
    }
    return { ok: true, counts }
  } finally {
    await db.configuration.updateMany({ where: { id: 'global' }, data: { cleanupLockUntil: null } }).catch(() => undefined)
  }
}
