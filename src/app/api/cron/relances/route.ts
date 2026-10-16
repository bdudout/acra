import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { executerRelances } from '@/lib/relances.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/relances — RELANCES (quotidien) : un seul e-mail de synthèse par personne, toutes
 * organisations confondues (questionnaires, préconisations, plans d'action, recommandations d'audit,
 * contrôles à exécuter, dérogations arrivant à expiration, vérifications et validations en attente).
 * Idempotent (marqueurs anti-doublon par élément) — cf. lib/relances.server.
 * Planificateur externe, `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
// Authentification + une seule exécution simultanée (bail « relances »).
export const POST = cronRoute('relances', async (req: NextRequest) => {
  return NextResponse.json({ ok: true, ...(await executerRelances()) })
})
