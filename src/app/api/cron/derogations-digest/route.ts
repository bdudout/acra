import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { envoyerTableauBordMensuel } from '@/lib/tableau-bord-mensuel.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/derogations-digest — conservé pour les planificateurs existants : la synthèse des
 * dérogations fait désormais partie du tableau de bord mensuel (cron `tableau-bord-mensuel`). Exécute
 * le même envoi, qui n'a lieu qu'une fois par mois : l'appeler en plus ne double jamais l'e-mail.
 * `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
// Authentification + une seule exécution simultanée (bail « tableau-bord-mensuel »).
export const POST = cronRoute('tableau-bord-mensuel', async (req: NextRequest) => {
  return NextResponse.json({ ok: true, fusionneDans: 'tableau-bord-mensuel', ...(await envoyerTableauBordMensuel()) })
})
