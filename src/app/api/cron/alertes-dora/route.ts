import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { envoyerAlertesDora } from '@/lib/alertes-dora.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/alertes-dora — ALERTES URGENTES (toutes les heures) : échéances de déclaration des
 * incidents majeurs DORA (notification initiale, rapports intermédiaire et final) à venir ou dépassées.
 * E-mail dédié, hors synthèse quotidienne ; une alerte par phase et par statut (idempotent).
 * Planificateur externe, `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  return NextResponse.json({ ok: true, ...(await envoyerAlertesDora()) })
}
