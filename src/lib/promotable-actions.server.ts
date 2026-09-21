// ─── Actions « promotables » vers le plan d'action unifié ─────────────────────
// Certaines actions à mener ne sont PAS des PlanAction (mesures d'analyse EBIOS,
// incidents…). Pour pouvoir les rattacher à un contrôle de conformité, on les
// « promeut » : création d'un PlanAction reprenant leurs champs, porteur de deux
// liens — CONFORMITE (le contrôle) + le lien vers l'objet d'ORIGINE (ANALYSE,
// INCIDENT…). L'objet source reste inchangé. Cette lib fournit la liste des
// candidats avec leur lien d'origine ; la création se fait via l'API plans-actions.

import { prisma } from './prisma'
import { normalizeMesure, normalizeIncident } from './action-items'
import type { PlanActionLienType } from './plan-action'

interface ModulesLike { incidentsActive: boolean }

/** Action promotable en plan d'action (mesure d'analyse ou incident pas encore un PlanAction) : clé stable + champs repris. */
export interface PromotableAction {
  key: string // stable, unique (source:id)
  titre: string
  porteur: string | null
  echeance: string | null // ISO
  priorite: string
  statut: string
  origine: 'risque' | 'incident'
  /** Lien vers l'objet d'origine, à conserver sur le PlanAction promu. */
  originLien: { type: PlanActionLienType; targetId: string; ref?: string; label?: string }
}

/**
 * Actions promotables de l'org : mesures d'analyse (toujours) + incidents ouverts
 * (si module actif). Les actions du registre / conformité / orphelines sont déjà
 * des PlanAction → exclues (elles se rattachent directement).
 */
export async function gatherPromotableActions(orgId: string, mod: ModulesLike): Promise<PromotableAction[]> {
  const [mesures, incidents] = await Promise.all([
    prisma.mesure.findMany({
      where: { analyse: { organizationId: orgId } },
      select: { id: true, nom: true, description: true, statut: true, priorite: true, responsable: true, entite: true, echeance: true, analyseId: true },
    }),
    mod.incidentsActive
      ? prisma.incident.findMany({
          where: { organizationId: orgId, statut: { not: 'REJETE' } },
          select: { id: true, intitule: true, description: true, statut: true, impactEstime: true, entite: true, riskItemId: true },
        })
      : Promise.resolve([]),
  ])

  const out: PromotableAction[] = []
  for (const m of mesures) {
    const it = normalizeMesure(m)
    out.push({
      key: `MESURE:${m.id}`, titre: it.titre, porteur: it.porteur,
      echeance: it.echeance ? it.echeance.toISOString() : null, priorite: it.priorite, statut: it.statut,
      origine: 'risque', originLien: { type: 'ANALYSE', targetId: m.analyseId, label: it.titre.slice(0, 200) },
    })
  }
  for (const i of incidents) {
    const it = normalizeIncident(i)
    if (!it) continue
    out.push({
      key: `INCIDENT:${i.id}`, titre: it.titre, porteur: it.porteur,
      echeance: it.echeance ? it.echeance.toISOString() : null, priorite: it.priorite, statut: it.statut,
      origine: 'incident', originLien: { type: 'INCIDENT', targetId: i.id, label: it.titre.slice(0, 200) },
    })
  }
  return out
}
