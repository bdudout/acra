import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { executerRelances } from '@/lib/relances.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/derogations-expiry — conservé pour les planificateurs existants : ces relances font désormais
 * partie de l'e-mail de synthèse unique par personne (cron `relances`). Exécute le même passage,
 * idempotent : appeler les deux le même jour n'envoie jamais de second e-mail.
 * `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  return NextResponse.json({ ok: true, fusionneDans: 'relances', ...(await executerRelances()) })
}
