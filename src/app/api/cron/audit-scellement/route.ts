import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { scellerJournal } from '@/lib/audit-chaine.server'
import { purgerJournal } from '@/lib/audit-purge.server'
import { auditLog } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/audit-scellement — scelle les entrées du journal d'audit (chaînage par empreintes, lib/audit-chaine),
 * puis applique la rétention si elle est définie (purge ARCHIVÉE des entrées scellées anciennes, lib/audit-purge.server).
 * Planificateur externe, `Authorization: Bearer <CRON_SECRET>` ; une seule exécution simultanée (bail).
 * Ne renvoie que des compteurs, l'ancre et la clé d'archive (aucun contenu du journal).
 */
export const POST = cronRoute('audit-scellement', async (_req: NextRequest) => {
  const scellement = await scellerJournal()
  const purge = await purgerJournal()
  if (purge.purgees > 0 && 'archiveCle' in purge) {
    await auditLog('AUDIT_PURGE', { targetType: 'instance', details: { purgees: purge.purgees, jusquaSeq: purge.jusquaSeq, archiveCle: purge.archiveCle, archiveSha256: purge.archiveSha256 } })
  }
  return NextResponse.json({ ok: true, scellees: scellement.scellees, ancre: scellement.ancre, purge })
})
