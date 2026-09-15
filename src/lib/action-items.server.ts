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
  normalizeConformiteTraitement,
  normalizeEcosystemeMesure,
  normalizeOrphanPlanAction,
  type ActionItem,
} from './action-items'
import { uid } from './uid'

interface ModulesLike {
  incidentsActive: boolean
  controlePermanentActive: boolean
  auditInterneActive: boolean
  registreRisquesActive: boolean
  conformiteActive: boolean
}

/**
 * Agrège les actions de l'organisation active. Les analyses EBIOS (mesures) sont
 * toujours incluses ; les autres sources sont conditionnées à l'activation de
 * leur module. Retourne les ActionItem non triés (le tri/filtre est appliqué
 * côté vue selon les préférences utilisateur).
 */
export async function gatherActionItems(orgId: string, mod: ModulesLike): Promise<ActionItem[]> {
  const orgFilter = { organizationId: orgId }

  const [mesureRows, ecoAnalyses, riskActionRows, conformiteData, constatRows, execRows, incidentRows, orphanRows] = await Promise.all([
    // Mesures rattachées aux analyses de l'organisation active.
    prisma.mesure.findMany({
      where: { analyse: { organizationId: orgId } },
      select: {
        id: true, nom: true, description: true, statut: true, priorite: true,
        responsable: true, entite: true, echeance: true, analyseId: true,
      },
    }),
    // Mesures d'écosystème (Atelier 3) — stockées en JSON sur les scénarios stratégiques.
    prisma.analyse.findMany({
      where: { organizationId: orgId },
      select: { id: true, scenariosStrategiques: { select: { mesuresEcosysteme: true } } },
    }),
    mod.registreRisquesActive
      ? prisma.planAction.findMany({
          where: { ...orgFilter, liens: { some: { type: 'RISQUE' } } },
          select: {
            id: true, titre: true, description: true, porteur: true,
            echeance: true, statut: true, priorite: true,
            liens: { where: { type: 'RISQUE' }, select: { targetId: true }, take: 1 },
          },
        })
      : Promise.resolve([]),
    // Facette « conformité » = traitements « plan d'action » (ConformiteTraitement)
    // + actions réelles rattachées à un contrôle (PlanAction porteur d'un lien
    // CONFORMITE). Dérogations/acceptations exclues : ce ne sont pas des actions.
    mod.conformiteActive
      ? Promise.all([
          prisma.conformiteTraitement.findMany({
            where: { ...orgFilter, type: 'PLAN_ACTION' },
            select: {
              id: true, intitule: true, description: true, responsable: true,
              echeance: true, statut: true, referentiel: true, refs: true,
            },
          }),
          prisma.planAction.findMany({
            where: { ...orgFilter, liens: { some: { type: 'CONFORMITE' } } },
            select: {
              id: true, titre: true, description: true, porteur: true, echeance: true, statut: true,
              liens: { where: { type: 'CONFORMITE' }, select: { targetId: true, ref: true }, take: 1 },
            },
          }),
        ])
      : Promise.resolve([[], []] as const),
    mod.auditInterneActive
      ? prisma.auditConstat.findMany({
          where: orgFilter,
          select: {
            id: true, intitule: true, recommandation: true, criticite: true,
            statut: true, responsableAction: true, echeance: true, riskItemId: true, missionId: true, source: true,
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
    // Actions ORPHELINES : PlanAction sans aucun lien source (à signaler/éditer).
    prisma.planAction.findMany({
      where: { ...orgFilter, liens: { none: {} } },
      select: { id: true, titre: true, description: true, porteur: true, entite: true, echeance: true, statut: true, priorite: true },
    }),
  ])

  const items: ActionItem[] = []

  for (const m of mesureRows) {
    // Lien ancré : ouvre l'atelier 5 et défile jusqu'à la mesure concernée.
    items.push(normalizeMesure(m, { lien: `/analyses/${m.analyseId}/atelier/5?tab=mesures#mesure-${m.id}` }))
  }
  // Mesures d'écosystème (A3) : rattachées à un prestataire, lien vers l'atelier 3.
  for (const a of ecoAnalyses) {
    for (const sc of a.scenariosStrategiques) {
      const list = Array.isArray(sc.mesuresEcosysteme) ? (sc.mesuresEcosysteme as Array<Record<string, unknown>>) : []
      for (const m of list) {
        const nom = String(m?.mesure ?? '')
        if (!nom.trim()) continue
        const id = String(m?.id ?? uid())
        items.push(normalizeEcosystemeMesure(
          { id, nom, description: m?.description, type: m?.type, priorite: m?.priorite, statut: m?.statut, partiePrenante: m?.partiePrenante },
          { lien: `/analyses/${a.id}/atelier/3?tab=mesures#mesure-${id}` },
        ))
      }
    }
  }
  for (const p of riskActionRows) {
    const riskItemId = p.liens[0]?.targetId ?? null
    items.push(normalizeRiskAction(
      { id: p.id, intitule: p.titre, description: p.description, responsable: p.porteur, echeance: p.echeance, statut: p.statut, priorite: p.priorite, riskItemId },
      { lien: riskItemId ? `/registre?item=${riskItemId}` : '/registre' },
    ))
  }
  const [conformiteTraitements, conformitePlanActions] = conformiteData
  for (const ct of conformiteTraitements) {
    const ref = Array.isArray(ct.refs) && ct.refs.length ? `&ctrl=${encodeURIComponent(String(ct.refs[0]))}` : ''
    items.push(normalizeConformiteTraitement(ct, { lien: `/conformite/socle?ref=${encodeURIComponent(ct.referentiel)}${ref}` }))
  }
  // Actions réelles rattachées à un contrôle : projetées dans la facette conformité
  // (l'action peut aussi apparaître sous une autre origine via ses autres liens).
  for (const pa of conformitePlanActions) {
    const referentiel = pa.liens[0]?.targetId ?? ''
    const ctrl = pa.liens[0]?.ref
    const lien = `/conformite/socle?ref=${encodeURIComponent(referentiel)}${ctrl ? `&ctrl=${encodeURIComponent(ctrl)}` : ''}`
    items.push(normalizeConformiteTraitement(
      { id: pa.id, intitule: pa.titre, description: pa.description, responsable: pa.porteur, echeance: pa.echeance, statut: pa.statut, referentiel, refs: ctrl ? [ctrl] : [] },
      { lien },
    ))
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
  for (const o of orphanRows) {
    items.push(normalizeOrphanPlanAction(o))
  }

  return items
}
