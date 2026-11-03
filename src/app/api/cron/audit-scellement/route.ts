import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { scellerJournal } from '@/lib/audit-chaine.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/audit-scellement — scelle les entrées du journal d'audit (chaînage par empreintes, lib/audit-chaine).
 * Planificateur externe, `Authorization: Bearer <CRON_SECRET>` ; une seule exécution simultanée (bail).
 * Ne renvoie que des compteurs et l'ancre (aucun contenu du journal).
 */
export const POST = cronRoute('audit-scellement', async (_req: NextRequest) => {
  const r = await scellerJournal()
  return NextResponse.json({ ok: true, scellees: r.scellees, ancre: r.ancre })
})
