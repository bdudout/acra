import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { envoyerAlertesDora } from '@/lib/alertes-dora.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/alertes-dora — ALERTES URGENTES (toutes les heures) : échéances de déclaration des
 * incidents majeurs DORA (notification initiale, rapports intermédiaire et final) à venir ou dépassées.
 * E-mail dédié, hors synthèse quotidienne ; une alerte par phase et par statut (idempotent).
 * Planificateur externe, `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
// Authentification + une seule exécution simultanée (bail « alertes-dora »).
export const POST = cronRoute('alertes-dora', async (req: NextRequest) => {
  return NextResponse.json({ ok: true, ...(await envoyerAlertesDora()) })
})
