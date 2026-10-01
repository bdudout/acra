import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { envoyerTableauBordMensuel } from '@/lib/tableau-bord-mensuel.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/derogations-digest — conservé pour les planificateurs existants : la synthèse des
 * dérogations fait désormais partie du tableau de bord mensuel (cron `tableau-bord-mensuel`). Exécute
 * le même envoi, qui n'a lieu qu'une fois par mois : l'appeler en plus ne double jamais l'e-mail.
 * `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  return NextResponse.json({ ok: true, fusionneDans: 'tableau-bord-mensuel', ...(await envoyerTableauBordMensuel()) })
}
