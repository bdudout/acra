import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { dispatchDueWebhooks } from '@/lib/webhook.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/webhooks-dispatch — LIVRAISON des webhooks sortants en attente.
 *
 * À appeler par un planificateur externe avec `Authorization: Bearer <CRON_SECRET>`.
 * Traite un lot de livraisons dues (backoff exponentiel, abandon au plafond de
 * tentatives). 503 si CRON_SECRET absent ; 401 si le secret ne correspond pas.
 */
// Authentification + une seule exécution simultanée (bail « webhooks-dispatch »).
export const POST = cronRoute('webhooks-dispatch', async (req: NextRequest) => {
  const resume = await dispatchDueWebhooks()
  return NextResponse.json({ ok: true, ...resume })
})
