// ─── Rapport des méthodes à saisie directe — chargement serveur (P4) ────────
// Réunit les critères de l'organisation (échelle + appétit, comme l'écran) et les
// plans d'action liés aux risques de l'analyse (liens RISQUE_ANALYSE, ref = analyse),
// puis délègue la construction au module pur `rapport-methode-directe`.

import { prisma } from '@/lib/prisma'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { getOrgConfig } from '@/lib/org-config.server'
import { buildDirectReport, type DirectReport, type DirectReportInput } from '@/lib/rapport-methode-directe'

/** Construit le rapport d'une analyse déjà chargée (accès vérifié par l'appelant). */
export async function loadDirectReport(analyse: {
  id: string; nom: string; methode: string; organizationId: string | null
  cadrage: DirectReportInput['analyse']['cadrage']
  risques: DirectReportInput['risques']
  mesures: DirectReportInput['mesures']
}): Promise<DirectReport> {
  const [scale, orgConfig, plans] = await Promise.all([
    getEffectiveScaleConfig(analyse.organizationId),
    getOrgConfig(analyse.organizationId),
    // Plans d'action : org-scopés ; une analyse sans organisation n'en a pas.
    analyse.organizationId
      ? prisma.planAction.findMany({
          where: { organizationId: analyse.organizationId, liens: { some: { type: 'RISQUE_ANALYSE', ref: analyse.id } } },
          orderBy: [{ echeance: 'asc' }, { createdAt: 'asc' }],
          select: {
            titre: true, statut: true, priorite: true, echeance: true, porteur: true,
            liens: { where: { type: 'RISQUE_ANALYSE', ref: analyse.id }, select: { targetId: true } },
          },
        })
      : Promise.resolve([]),
  ])
  return buildDirectReport({
    analyse: { nom: analyse.nom, methode: analyse.methode, cadrage: analyse.cadrage },
    risques: analyse.risques,
    mesures: analyse.mesures,
    plans: plans.map(p => ({ titre: p.titre, statut: p.statut, priorite: p.priorite, echeance: p.echeance, porteur: p.porteur, risqueIds: p.liens.map(l => l.targetId) })),
  }, { scale, appetit: orgConfig.appetitRisque })
}
