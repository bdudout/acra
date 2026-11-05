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
  normalizeAnalyseRiskPlanAction,
  normalizeAuditConstat,
  normalizeControleAnomalie,
  lienSelonRole,
  normalizeIncident,
  normalizeConformiteTraitement,
  normalizeEcosystemeMesure,
  normalizeOrphanPlanAction,
  normalizeLinkedPlanAction,
  enrichirActions,
  indexerAxes,
  SOURCES_RISQUE_REGISTRE,
  type ActionItem,
} from './action-items'
import { uid } from './uid'
import { analyseWhereClause, peutLireConformite, peutVoirStrategie, type OrgScopeContext, type UserRole } from './permissions'
import { accesResultats } from './acces-resultats.server'

interface ModulesLike {
  incidentsActive: boolean
  controlePermanentActive: boolean
  auditInterneActive: boolean
  registreRisquesActive: boolean
  conformiteActive: boolean
  /** Module Stratégie (lot S2) : charge les axes rattachés ; absent = non chargé (ex. contrôle d'existence d'une source). */
  strategieActive?: boolean
}

/**
 * Agrège les actions de l'organisation active. Les analyses EBIOS (mesures) sont
 * toujours incluses ; les autres sources sont conditionnées à l'activation de
 * leur module. Retourne les ActionItem non triés (le tri/filtre est appliqué
 * côté vue selon les préférences utilisateur).
 */
export async function gatherActionItems(
  orgId: string,
  mod: ModulesLike,
  access: { userId: string; role: UserRole; scope: OrgScopeContext },
): Promise<ActionItem[]> {
  const orgFilter = { organizationId: orgId }
  // Les analyses ont un contrôle d'accès plus fin que l'organisation : un
  // analyste ne doit pas découvrir les mesures d'une analyse privée via /actions.
  const accessibleAnalyses = await prisma.analyse.findMany({
    where: { ...analyseWhereClause(access.userId, access.role, access.scope), ...orgFilter },
    select: { id: true },
  })
  const analyseIds = accessibleAnalyses.map(a => a.id)
  // Résultats d'audit et de contrôle : même visibilité que les écrans /audit et /controles (lib/acces-resultats) — la
  // 1re ligne et la lecture seule ne voient que les constats de leurs missions ou dont l'action leur revient, et les
  // anomalies des contrôles dont elles sont responsables. Les rôles à lecture globale du dispositif voient tout.
  const acces = mod.auditInterneActive || mod.controlePermanentActive
    ? await accesResultats(access.userId, access.role)
    : { tout: true, concerne: () => true }

  const [mesureRows, ecoAnalyses, riskActionRows, analyseRiskPlanRows, conformiteData, constatRows, execRows, incidentRows, orphanRows, linkedRows] = await Promise.all([
    // Mesures rattachées aux analyses de l'organisation active.
    prisma.mesure.findMany({
      where: { analyseId: { in: analyseIds } },
      select: {
        id: true, nom: true, description: true, statut: true, priorite: true,
        responsable: true, entite: true, entiteId: true, echeance: true, analyseId: true,
      },
    }),
    // Mesures d'écosystème (Atelier 3) — stockées en JSON sur les scénarios stratégiques.
    prisma.analyse.findMany({
      where: { ...orgFilter, id: { in: analyseIds } },
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
    // Plans d'action des risques saisis directement (ISO/IEC 27005, ISO 31000,
    // NIST SP 800-30). Ce sont les mêmes objets PlanAction unifiés ; ils restent
    // visibles même si le module de registre M1 est désactivé.
    prisma.planAction.findMany({
      where: { ...orgFilter, liens: { some: { type: 'RISQUE_ANALYSE', ref: { in: analyseIds } } } },
      select: {
        id: true, titre: true, description: true, porteur: true, entite: true, entiteId: true,
        echeance: true, statut: true, priorite: true,
        liens: { where: { type: 'RISQUE_ANALYSE', ref: { in: analyseIds } }, select: { targetId: true, ref: true }, take: 1 },
      },
    }),
    // Facette « conformité » = traitements « plan d'action » (ConformiteTraitement)
    // + actions réelles rattachées à un contrôle (PlanAction porteur d'un lien
    // CONFORMITE). Dérogations/acceptations exclues : ce ne sont pas des actions. Même droit de lecture que /conformite.
    mod.conformiteActive && peutLireConformite(access.role)
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
            mission: { select: { responsable: true } },
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
            impactEstime: true, entite: true, entiteId: true, riskItemId: true,
          },
        })
      : Promise.resolve([]),
    // Actions ORPHELINES : PlanAction sans aucun lien source (à signaler/éditer).
    prisma.planAction.findMany({
      where: { ...orgFilter, liens: { none: {} } },
      select: { id: true, titre: true, description: true, porteur: true, entite: true, entiteId: true, echeance: true, statut: true, priorite: true },
    }),
    // Actions issues d'un test de résilience ou d'une préconisation (pas de liste propre).
    prisma.planAction.findMany({
      where: { ...orgFilter, liens: { some: { type: { in: ['TEST_RESILIENCE', 'PRECONISATION'] } } } },
      select: {
        id: true, titre: true, description: true, porteur: true, entite: true, entiteId: true, echeance: true, statut: true, priorite: true,
        liens: { where: { type: { in: ['TEST_RESILIENCE', 'PRECONISATION'] } }, select: { type: true, targetId: true }, take: 1 },
      },
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
  for (const p of analyseRiskPlanRows) {
    const lien = p.liens[0]
    if (!lien) continue
    items.push(normalizeAnalyseRiskPlanAction(
      {
        id: p.id, titre: p.titre, description: p.description, porteur: p.porteur,
        entite: p.entite, entiteId: p.entiteId, echeance: p.echeance, statut: p.statut, priorite: p.priorite,
        risqueId: lien.targetId,
      },
      { lien: lien.ref ? `/analyses/${encodeURIComponent(lien.ref)}/atelier/1` : null },
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
  for (const { mission, ...c } of constatRows) {
    // Règle de visibiliteMission (mission dont on est responsable, sinon ses seuls constats), appliquée constat par constat.
    if (!acces.tout && !acces.concerne(mission?.responsable) && !acces.concerne(c.responsableAction)) continue
    items.push(normalizeAuditConstat(c, { lien: `/audit?mission=${c.missionId}` }))
  }
  for (const e of execRows) {
    if (!acces.tout && !acces.concerne(e.controle?.responsable)) continue
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

  for (const l of linkedRows) {
    const lien = l.liens[0]
    if (!lien) continue
    const isTest = lien.type === 'TEST_RESILIENCE'
    items.push(normalizeLinkedPlanAction(l, isTest ? 'resilience' : 'preconisation', {
      lien: isTest ? `/reglementaire/tests-resilience?test=${lien.targetId}` : `/controles/questionnaires?preconisation=${lien.targetId}`,
    }))
  }

  // Lot S2 : famille TIC des risques du registre liés et axes des stratégies non archivées — une requête chacune
  // (aucun N+1), seulement si nécessaire. Les rattachements sont filtrés par clé d'item : seuls ceux des actions
  // déjà visibles ci-dessus sont projetés (aucun affaiblissement de la visibilité). Les titres de stratégie et d'axe
  // ne sont livrés qu'aux rôles qui lisent les stratégies (peutVoirStrategie, même garde que GET /api/strategies).
  const chargerAxes = !!mod.strategieActive && peutVoirStrategie(access.role) && items.length > 0
  const riskItemIds = [...new Set(items.filter(i => i.riskItemId && SOURCES_RISQUE_REGISTRE.includes(i.source)).map(i => i.riskItemId as string))]
  const [familleRows, rattachementRows] = await Promise.all([
    riskItemIds.length
      ? prisma.riskItem.findMany({ where: { organizationId: orgId, id: { in: riskItemIds } }, select: { id: true, familleRisqueTic: true } })
      : Promise.resolve([]),
    chargerAxes
      ? prisma.rattachementStrategique.findMany({
          where: { organizationId: orgId, sourceId: { in: [...new Set(items.map(i => i.sourceId))] }, axe: { strategie: { organizationId: orgId, statut: { not: 'ARCHIVEE' } } } },
          select: { sourceType: true, sourceId: true, axe: { select: { id: true, titre: true, strategie: { select: { id: true, titre: true } } } } },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
  ])
  const familles = new Map(familleRows.map(r => [r.id, r.familleRisqueTic]))
  const enrichis = enrichirActions(items, familles, indexerAxes(rattachementRows))

  // Recette n° 22 : pas de lien vers une source que le rôle ne peut pas ouvrir ; « Voir » pour la consultation.
  return enrichis.map(it => ({ ...it, ...lienSelonRole(it.lien, access.role) }))
}

/** Axe proposé au rattachement depuis /actions (stratégie non archivée de l'organisation). */
export interface AxeDisponible { strategieId: string; strategieTitre: string; strategieStatut: string; axeId: string; axeTitre: string }

/** Plafond du menu « Rattacher à un axe ». */
export const AXES_DISPONIBLES_MAX = 200

/**
 * Axes des stratégies NON archivées de l'organisation (menu « Rattacher à un axe »), en une requête bornée ;
 * vide pour un rôle qui ne lit pas les stratégies (peutVoirStrategie).
 */
export async function axesStrategiquesActifs(orgId: string, role: UserRole): Promise<AxeDisponible[]> {
  if (!peutVoirStrategie(role)) return []
  const axes = await prisma.axeStrategique.findMany({
    take: AXES_DISPONIBLES_MAX,
    where: { strategie: { organizationId: orgId, statut: { not: 'ARCHIVEE' } } },
    select: { id: true, titre: true, strategie: { select: { id: true, titre: true, statut: true } } },
    orderBy: [{ strategie: { createdAt: 'desc' } }, { ordre: 'asc' }, { createdAt: 'asc' }],
  })
  return axes.map(a => ({ strategieId: a.strategie.id, strategieTitre: a.strategie.titre, strategieStatut: a.strategie.statut, axeId: a.id, axeTitre: a.titre }))
}
