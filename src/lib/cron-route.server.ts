// ─── Route cron : authentification + bail d'exécution ─────────────────────────
// Toute route /api/cron/* passe par ici : secret d'infrastructure (lib/cron-auth), puis une seule
// exécution simultanée par tâche (lib/cron-verrou.server), exécution tracée (lib/taches.server). Une exécution déjà en cours répond 200
// `{ ok: true, ignore: 'deja_en_cours' }` : ce n'est pas une erreur pour le planificateur.
import { NextResponse, type NextRequest } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { avecVerrouCron } from '@/lib/cron-verrou.server'
import { executerTache } from '@/lib/taches.server'

export function cronRoute(tache: string, handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    const denied = assertCronAuth(req)
    if (denied) return denied
    // Exécution tracée (lib/taches.server) : échec signalé et relançable ; relance manuelle repérée par l'en-tête.
    const declencheur = req.headers?.get?.('x-acra-declencheur') === 'manuel' ? 'MANUEL' : 'CRON'
    const r = await avecVerrouCron(tache, () => executerTache(tache, declencheur, () => handler(req)))
    return r.execute ? r.resultat : NextResponse.json({ ok: true, ignore: 'deja_en_cours', tache })
  }
}
