import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { envoyerTableauBordMensuel } from '@/lib/tableau-bord-mensuel.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/tableau-bord-mensuel — le 1er du mois, TABLEAU DE BORD du mois écoulé aux RSSI et
 * gestionnaires des risques (administrateurs à défaut) : un e-mail par personne, une section par
 * organisation (indicateurs clés et points d'attention). Une seule exécution par mois (idempotent).
 * Planificateur externe, `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
// Authentification + une seule exécution simultanée (bail « tableau-bord-mensuel »).
export const POST = cronRoute('tableau-bord-mensuel', async (req: NextRequest) => {
  return NextResponse.json({ ok: true, ...(await envoyerTableauBordMensuel()) })
})
