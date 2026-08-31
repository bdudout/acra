// ─── Consolidation GRC (organisation active) — accès serveur partagé ─────────
// Rassemble, pour l'organisation active et ses modules ACTIFS, les indicateurs
// des différents domaines (risques, appétit, incidents, contrôle permanent,
// audit, suivi régulateur, KRI, DORA) dans la forme canonique `ComiteConsolide`.
// Point UNIQUE consommé par les dossiers de comité ET le rapport annuel de
// contrôle interne — évite toute duplication de requêtes/agrégations.

import { prisma } from './prisma'
import { niveauRisque } from './risk-item'
import { summarizeActions } from './risk-action'
import { rollupRisks, type RiskLite } from './grc-rollup'
import { buildHeatGrid } from './carto-export'
import type { CartoRisk } from './cartographie'
import { rollupIncidents, rollupControles, rollupControlesParNiveau, rollupAudit, type CockpitIncident, type CockpitExecution, type CockpitConstat } from './grc-cockpit'
import { synthetiserAppetit, cleanAppetitConfig, type RiskAppetitLite } from './appetit'
import { evaluerKri, synthetiserKri, type KriSens } from './kri'
import { classifierIncident, estEvalueDora, synthetiserDora, type DoraCriteres, type DoraClasse } from './dora'
import { synthetiserSuiviRegulateur, type ConstatRegulateur } from './suivi-regulateur'
import { type ComiteConsolide, type ComiteModules } from './comite-pack'

interface OrgConfigLike {
  incidentsActive: boolean
  controlePermanentActive: boolean
  auditInterneActive: boolean
  kriActive: boolean
  reglementaireActive: boolean
  appetitRisque: unknown
}

export async function gatherGrcConsolide(
  orgId: string,
  cfg: OrgConfigLike,
  now: Date = new Date(),
): Promise<{ consolide: ComiteConsolide; modules: ComiteModules }> {
  const withIncidents = cfg.incidentsActive
  const withControles = cfg.controlePermanentActive
  const withAudit = cfg.auditInterneActive
  const withKri = cfg.kriActive
  const withReglementaire = cfg.reglementaireActive
  const orgFilter = { organizationId: orgId }

  const [riskRows, actionRows, incidentRows, controleRows, executionRows, missionRows, constatRows, kriRows] = await Promise.all([
    prisma.riskItem.findMany({ where: orgFilter, select: { organizationId: true, taxonomieCode: true, graviteInherente: true, vraisemblanceInherente: true, graviteResiduelle: true, vraisemblanceResiduelle: true } }),
    prisma.riskAction.findMany({ where: orgFilter, select: { organizationId: true, statut: true, echeance: true } }),
    withIncidents ? prisma.incident.findMany({ where: orgFilter, select: { organizationId: true, statut: true, montantBrut: true, recuperations: true, doraCriteres: true } }) : Promise.resolve([]),
    withControles ? prisma.controle.findMany({ where: { ...orgFilter, actif: true }, select: { organizationId: true, niveau: true } }) : Promise.resolve([]),
    withControles ? prisma.controleExecution.findMany({ where: orgFilter, select: { organizationId: true, resultat: true, dateRealisation: true, controle: { select: { niveau: true } } } }) : Promise.resolve([]),
    withAudit ? prisma.auditMission.findMany({ where: orgFilter, select: { organizationId: true } }) : Promise.resolve([]),
    (withAudit || withReglementaire) ? prisma.auditConstat.findMany({ where: orgFilter, select: { organizationId: true, criticite: true, statut: true, echeance: true, source: true, intitule: true, recommandation: true, responsableAction: true } }) : Promise.resolve([]),
    withKri ? prisma.kri.findMany({ where: { ...orgFilter, actif: true }, select: { sens: true, seuilAlerte: true, seuilCritique: true, mesures: { orderBy: { dateMesure: 'desc' }, take: 1, select: { valeur: true } } } }) : Promise.resolve([]),
  ])

  const risks: RiskLite[] = riskRows.map(r => ({
    organizationId: r.organizationId,
    niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
  }))

  const appetit = cleanAppetitConfig(cfg.appetitRisque)
  const appetitDefini = appetit.seuilGlobal != null || Object.keys(appetit.parCategorie).length > 0
  const appetitRows: RiskAppetitLite[] = riskRows.map(r => ({ taxonomieCode: r.taxonomieCode, niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle) }))

  // Heatmap gravité × vraisemblance (mode résiduel) pour le rendu décideur (#134).
  const cartoRisks: CartoRisk[] = riskRows.map((r, i) => ({
    id: String(i), intitule: '', taxonomieCode: r.taxonomieCode, processusId: null, processusNom: null, entite: null,
    graviteInherente: r.graviteInherente, vraisemblanceInherente: r.vraisemblanceInherente,
    graviteResiduelle: r.graviteResiduelle, vraisemblanceResiduelle: r.vraisemblanceResiduelle,
  }))
  const grid = buildHeatGrid(cartoRisks, 'residual')

  const consolide: ComiteConsolide = { risques: { ...rollupRisks(risks), grid } }
  const act = summarizeActions(actionRows, now)
  consolide.actions = { total: act.total, faits: act.faits, enRetard: act.enRetard, tauxAvancement: act.tauxAvancement }

  if (appetitDefini) {
    const a = synthetiserAppetit(appetitRows, appetit)
    consolide.appetit = { horsAppetit: a.horsAppetit, dansAppetit: a.dansAppetit, evalues: a.evalues }
  }
  if (withIncidents) {
    const incidents: CockpitIncident[] = incidentRows.map(i => ({ organizationId: i.organizationId, statut: i.statut as CockpitIncident['statut'], montantBrut: i.montantBrut == null ? null : Number(i.montantBrut), recuperations: i.recuperations == null ? null : Number(i.recuperations) }))
    consolide.incidents = rollupIncidents(incidents)
  }
  if (withControles) {
    const execs: CockpitExecution[] = executionRows.map(e => ({ organizationId: e.organizationId, resultat: e.resultat, dateRealisation: e.dateRealisation, niveau: e.controle?.niveau }))
    const ctrls = controleRows.map(c => ({ organizationId: c.organizationId, niveau: c.niveau }))
    const cr = rollupControles(ctrls, execs)
    const pn = rollupControlesParNiveau(ctrls, execs)
    const niv = (t: typeof pn.N1) => ({ tauxConformite: t.tauxConformite, anomalies: t.anomalies, controles: t.controles })
    consolide.controles = {
      tauxConformite: cr.tauxConformite, anomalies: cr.anomalies,
      parNiveau: { N1: niv(pn.N1), N2: niv(pn.N2) },
    }
  }
  if (withAudit) {
    const constats: CockpitConstat[] = constatRows.map(c => ({ organizationId: c.organizationId, criticite: c.criticite, statut: c.statut, echeance: c.echeance }))
    const au = rollupAudit(missionRows, constats, now)
    consolide.audit = { critiques: au.critiques, recosEnRetard: au.recosEnRetard }
  }
  if (withReglementaire) {
    const regConstats: ConstatRegulateur[] = constatRows.filter(c => c.source === 'REGULATEUR').map(c => ({ id: '', intitule: c.intitule, description: null, recommandation: c.recommandation, criticite: c.criticite, source: c.source, statut: c.statut, echeance: c.echeance, responsableAction: c.responsableAction, missionIntitule: null }))
    const sr = synthetiserSuiviRegulateur(regConstats, now)
    consolide.regulateur = { echues: sr.echues, sous30j: sr.sous30j }

    const classes: DoraClasse[] = []
    for (const i of incidentRows) {
      const criteres = (i.doraCriteres ?? {}) as DoraCriteres
      if (!estEvalueDora(criteres)) continue
      classes.push(classifierIncident(criteres).classe)
    }
    const d = synthetiserDora(classes)
    consolide.dora = { majeurs: d.majeurs, evalues: d.evalues }
  }
  if (withKri) {
    const statuts = kriRows.map(k => ({ statut: evaluerKri(k.mesures[0]?.valeur ?? null, { sens: k.sens as KriSens, seuilAlerte: k.seuilAlerte, seuilCritique: k.seuilCritique }) }))
    const k = synthetiserKri(statuts)
    consolide.kri = { enAlerte: k.enAlerte, critique: k.critique }
  }

  const modules: ComiteModules = {
    risques: true, appetit: appetitDefini, incidents: withIncidents, controles: withControles,
    audit: withAudit, regulateur: withReglementaire, kri: withKri, dora: withReglementaire,
  }
  return { consolide, modules }
}
