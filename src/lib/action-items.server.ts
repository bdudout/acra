// ─── Plans d'action unifiés — accès serveur ──────────────────────────────────
// Charge, pour l'organisation active et ses modules ACTIFS, les actions des
// quatre/cinq sources (mesures d'analyse, actions du registre, recommandations
// d'audit, anomalies de contrôle, incidents ouverts), construit le lien profond
// vers chaque fiche, puis normalise vers `ActionItem` (lib pure). Point unique
// consommé par la page /plans-actions.

import { prisma } from './prisma'
import {
  normalizeMesure,
  normalizeRiskAction,
  normalizeAuditConstat,
  normalizeControleAnomalie,
  normalizeIncident,
  type ActionItem,
} from './action-items'

interface ModulesLike {
  incidentsActive: boolean
  controlePermanentActive: boolean
  auditInterneActive: boolean
  registreRisquesActive: boolean
}

/**
 * Agrège les actions de l'organisation active. Les analyses EBIOS (mesures) sont
 * toujours incluses ; les autres sources sont conditionnées à l'activation de
 * leur module. Retourne les ActionItem non triés (le tri/filtre est appliqué
 * côté vue selon les préférences utilisateur).
 */
export async function gatherActionItems(orgId: string, mod: ModulesLike): Promise<ActionItem[]> {
  const orgFilter = { organizationId: orgId }

  const [mesureRows, riskActionRows, constatRows, execRows, incidentRows] = await Promise.all([
    // Mesures rattachées aux analyses de l'organisation active.
    prisma.mesure.findMany({
      where: { analyse: { organizationId: orgId } },
      select: {
        id: true, nom: true, description: true, statut: true, priorite: true,
        responsable: true, entite: true, echeance: true, analyseId: true,
      },
    }),
    mod.registreRisquesActive
      ? prisma.riskAction.findMany({
          where: orgFilter,
          select: {
            id: true, intitule: true, description: true, responsable: true,
            echeance: true, statut: true, priorite: true, riskItemId: true,
          },
        })
      : Promise.resolve([]),
    mod.auditInterneActive
      ? prisma.auditConstat.findMany({
          where: orgFilter,
          select: {
            id: true, intitule: true, recommandation: true, criticite: true,
            statut: true, responsableAction: true, echeance: true, riskItemId: true, missionId: true,
          },
        })
      : Promise.resolve([]),
    mod.controlePermanentActive
      ? prisma.controleExecution.findMany({
          where: { ...orgFilter, resultat: 'ANOMALIE' },
          select: {
            id: true, constat: true, dateRealisation: true, controleId: true,
            controle: { select: { intitule: true, responsable: true } },
          },
        })
      : Promise.resolve([]),
    mod.incidentsActive
      ? prisma.incident.findMany({
          where: { ...orgFilter, statut: { not: 'REJETE' } },
          select: {
            id: true, intitule: true, description: true, statut: true,
            impactEstime: true, entite: true, riskItemId: true,
          },
        })
      : Promise.resolve([]),
  ])

  const items: ActionItem[] = []

  for (const m of mesureRows) {
    items.push(normalizeMesure(m, { lien: `/analyses/${m.analyseId}` }))
  }
  for (const a of riskActionRows) {
    items.push(normalizeRiskAction(a, { lien: a.riskItemId ? `/registre?item=${a.riskItemId}` : '/registre' }))
  }
  for (const c of constatRows) {
    items.push(normalizeAuditConstat(c, { lien: `/audit?mission=${c.missionId}` }))
  }
  for (const e of execRows) {
    items.push(
      normalizeControleAnomalie(
        { id: e.id, controleNom: e.controle?.intitule ?? '', constat: e.constat, dateRealisation: e.dateRealisation, responsable: e.controle?.responsable },
        { lien: `/controles?controle=${e.controleId}` },
      ),
    )
  }
  for (const i of incidentRows) {
    const it = normalizeIncident(i, { lien: `/incidents?incident=${i.id}` })
    if (it) items.push(it)
  }

  return items
}
