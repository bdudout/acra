import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { parseRapportSauvegarde, reponseRapportSauvegarde } from '@/lib/documents-coherence'
import { deposerSauvegardeImmediate } from '@/lib/update-request.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/sauvegarde-base — journal des sauvegardes de la base dans les tâches planifiées.
 *  - Avec `{ rapport }` (agent hôte, scripts/acra-schedule.sh) : consigne le résultat d'une sauvegarde ; un échec rend l'exécution
 *    en ÉCHEC (alerte TACHE_PLANIFIEE_ECHEC au journal d'audit → SIEM).
 *  - Sans rapport (relance depuis Administration → Tâches planifiées) : dépose une demande de sauvegarde immédiate pour l'agent
 *    (202) ; agent absent, mise à jour en cours ou demande en attente → 409, donc relance en échec, visible.
 * L'application n'exécute aucune commande. `Authorization: Bearer <CRON_SECRET>`.
 */
export const POST = cronRoute('sauvegarde-base', async (req: NextRequest) => {
  const raw = await req.json().catch(() => null)
  const rapport = parseRapportSauvegarde(raw)
  if (rapport) {
    const r = reponseRapportSauvegarde(rapport)
    return NextResponse.json(r.body, { status: r.status })
  }
  if (raw && typeof raw === 'object' && 'rapport' in raw) return NextResponse.json({ ok: false, error: 'rapport_invalide' }, { status: 400 })
  const d = await deposerSauvegardeImmediate('tache-planifiee')
  if (!d.ok) return NextResponse.json({ ok: false, error: d.error }, { status: 409 })
  return NextResponse.json({ ok: true, demandee: true, id: d.id }, { status: 202 })
})
