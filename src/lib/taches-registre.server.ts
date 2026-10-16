// ─── Registre des tâches planifiées relançables depuis l'administration ─────────────────────
// Une relance appelle DIRECTEMENT le module de la route cron (même bail, même journal d'exécution),
// sans appel réseau vers l'application elle-même (fragile derrière un reverse-proxy).
import { NextRequest } from 'next/server'

const ROUTES = {
  'relances': () => import('@/app/api/cron/relances/route'),
  'tableau-bord-mensuel': () => import('@/app/api/cron/tableau-bord-mensuel/route'),
  'alertes-dora': () => import('@/app/api/cron/alertes-dora/route'),
  'appetence-snapshots': () => import('@/app/api/cron/appetence-snapshots/route'),
  'comite-snapshots': () => import('@/app/api/cron/comite-snapshots/route'),
  'conformite-snapshots': () => import('@/app/api/cron/conformite-snapshots/route'),
  'rapports-planifies': () => import('@/app/api/cron/rapports-planifies/route'),
  'webhooks-dispatch': () => import('@/app/api/cron/webhooks-dispatch/route'),
  'cleanup': () => import('@/app/api/cron/cleanup/route'),
  'demo-purge': () => import('@/app/api/cron/demo-purge/route'),
} as const

export type TachePlanifiee = keyof typeof ROUTES
export const TACHES_PLANIFIEES = Object.keys(ROUTES) as TachePlanifiee[]
export const estTachePlanifiee = (t: unknown): t is TachePlanifiee => typeof t === 'string' && Object.hasOwn(ROUTES, t)

/** Relance `tache` comme le planificateur (secret d'infrastructure), repérée comme déclenchement MANUEL. */
export async function relancerTache(tache: TachePlanifiee): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ ok: false, error: 'cron_desactive' }, { status: 503 })
  const { POST } = await ROUTES[tache]()
  return POST(new NextRequest(`http://localhost/api/cron/${tache}`, {
    method: 'POST', headers: { authorization: `Bearer ${secret}`, 'x-acra-declencheur': 'manuel' },
  }))
}
