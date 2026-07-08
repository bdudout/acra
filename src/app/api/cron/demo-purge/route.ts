import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/demo'
import { purgeExpiredDemoOrgs } from '@/lib/demo-server'
import { auditLog } from '@/lib/logger'

/**
 * POST /api/cron/demo-purge — purge des organisations démo expirées (ACRA-Demo).
 *
 * À appeler par un planificateur externe (cron système) avec l'en-tête
 * `Authorization: Bearer <CRON_SECRET>`. Supprime les organisations démo
 * (hors « global ») inactives depuis `inactivityDays` OU créées depuis plus de
 * `hardCapDays` (cf. lib/demo.ts) : analyses (cascade enfants) → organisation
 * (cascade memberships/config/conformités) → comptes de démo orphelins.
 *
 * Sécurité : 503 si CRON_SECRET absent ; 401 si secret invalide ; 400 si l'instance
 * n'est PAS en mode démo (ACRA_DEMO_MODE≠true) — garde-fou anti-purge en production.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron désactivé (CRON_SECRET absent)' }, { status: 503 })
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.nextUrl.searchParams.get('token') ?? ''
  if (token !== secret) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Garde-fou : ne JAMAIS purger sur une instance de production.
  if (!isDemoMode()) {
    return NextResponse.json({ error: 'Mode démo inactif (ACRA_DEMO_MODE≠true)' }, { status: 400 })
  }

  const { purged, orgIds } = await purgeExpiredDemoOrgs()
  if (purged > 0) {
    await auditLog('DEMO_ORG_PURGED', { targetType: 'organization', details: { purged, orgIds } })
  }
  return NextResponse.json({ ok: true, purged })
}
