import { NextRequest, NextResponse } from 'next/server'
import { purgeExpiredDemoOrgs, warnExpiringDemoOrgs, isDemoInstance } from '@/lib/demo-server'
import { auditLog } from '@/lib/logger'

/**
 * POST /api/cron/demo-purge — purge des organisations démo expirées (ACRA-Demo).
 *
 * À appeler par un planificateur externe (cron système) avec l'en-tête
 * `Authorization: Bearer <CRON_SECRET>`. Deux étapes : (1) PRÉAVIS par e-mail aux
 * organisations proches de l'expiration (fenêtre `warningDays`, une seule fois) ;
 * (2) PURGE des organisations démo (hors « global ») inactives depuis `inactivityDays`
 * OU créées depuis plus de `hardCapDays` (cf. lib/demo.ts) : analyses (cascade enfants)
 * → organisation (cascade memberships/config/conformités) → comptes de démo orphelins.
 *
 * Sécurité : 503 si CRON_SECRET absent ; 401 si secret invalide ; 400 si l'instance
 * n'est PAS une instance de démo prouvée — env `ACRA_DEMO_MODE=true` ET marqueur
 * d'instance figé à DEMO (cf. resolveInstanceMode). Une instance de prod flippée par
 * erreur en démo reste stampée PROD → purge refusée (garde-fou anti-destruction).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron désactivé (CRON_SECRET absent)' }, { status: 503 })
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.nextUrl.searchParams.get('token') ?? ''
  if (token !== secret) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Garde-fou : ne JAMAIS purger hors d'une instance de démo prouvée (env + marqueur figé).
  if (!(await isDemoInstance())) {
    return NextResponse.json({ error: 'Instance non démo — purge refusée' }, { status: 400 })
  }

  // Préavis d'abord (orgs proches de l'expiration), puis purge (orgs expirées).
  const { warned } = await warnExpiringDemoOrgs()
  const { purged, orgIds } = await purgeExpiredDemoOrgs()
  if (purged > 0) {
    await auditLog('DEMO_ORG_PURGED', { targetType: 'organization', details: { purged, orgIds } })
  }
  return NextResponse.json({ ok: true, warned, purged })
}
