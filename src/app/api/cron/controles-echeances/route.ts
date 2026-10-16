import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { executerRelances } from '@/lib/relances.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/controles-echeances — conservé pour les planificateurs existants : ces relances font désormais
 * partie de l'e-mail de synthèse unique par personne (cron `relances`). Exécute le même passage,
 * idempotent : appeler les deux le même jour n'envoie jamais de second e-mail.
 * `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
// Authentification + une seule exécution simultanée (bail « relances »).
export const POST = cronRoute('relances', async (req: NextRequest) => {
  return NextResponse.json({ ok: true, fusionneDans: 'relances', ...(await executerRelances()) })
})
