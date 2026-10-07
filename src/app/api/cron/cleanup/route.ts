import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { executeInstanceCleanup, getCleanupSettings } from '@/lib/cache-cleanup.instance.server'
import { recordDailyStorageSnapshot } from '@/lib/storage-usage.server'
import { auditLog } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/cleanup — nettoyage quotidien du cache sans impact (jetons, sessions, défis MFA, invitations, livraisons
 * de webhooks expirés ou consommés). Respecte la bascule d'instance `autoCleanup` et les catégories configurées.
 * Idempotent ; l'audit ne contient que des comptes.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  // Mesure quotidienne du stockage (tendance) et purge de l'historique > 400 j : indépendantes de la bascule de nettoyage.
  const storage = await recordDailyStorageSnapshot().catch(() => null)
  const settings = await getCleanupSettings()
  if (!settings.autoCleanup) return NextResponse.json({ skipped: true, storage })
  const r = await executeInstanceCleanup(settings.categories)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
  await auditLog('INSTANCE_CACHE_CLEANED', { targetType: 'instance', details: { counts: r.counts, trigger: 'cron' } })
  return NextResponse.json({ counts: r.counts, storage })
}
