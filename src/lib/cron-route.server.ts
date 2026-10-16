// ─── Route cron : authentification + bail d'exécution ─────────────────────────
// Toute route /api/cron/* passe par ici : secret d'infrastructure (lib/cron-auth), puis une seule
// exécution simultanée par tâche (lib/cron-verrou.server). Une exécution déjà en cours répond 200
// `{ ok: true, ignore: 'deja_en_cours' }` : ce n'est pas une erreur pour le planificateur.
import { NextResponse, type NextRequest } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { avecVerrouCron } from '@/lib/cron-verrou.server'

export function cronRoute(tache: string, handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    const denied = assertCronAuth(req)
    if (denied) return denied
    const r = await avecVerrouCron(tache, () => handler(req))
    return r.execute ? r.resultat : NextResponse.json({ ok: true, ignore: 'deja_en_cours', tache })
  }
}
