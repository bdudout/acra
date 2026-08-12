import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { niveauRisque } from '@/lib/risk-item'
import { summarizeActions } from '@/lib/risk-action'
import { rollupRisks, rollupByOrg, type RiskLite, type ScopedAction } from '@/lib/grc-rollup'
import {
  rollupIncidents, incidentsByOrg,
  rollupControles, controlesByOrg,
  rollupAudit, auditByOrg,
  type CockpitIncident, type CockpitExecution, type CockpitConstat,
} from '@/lib/grc-cockpit'
import { applyFilters, parseFilters } from '@/lib/risk-filters'
import { synthetiserAppetit, cleanAppetitConfig, type RiskAppetitLite } from '@/lib/appetit'
import { evaluerKri, synthetiserKri, type KriSens, type KriStatut } from '@/lib/kri'
import { classifierIncident, estEvalueDora, synthetiserDora, type DoraCriteres, type DoraClasse } from '@/lib/dora'

export const dynamic = 'force-dynamic'

// GET /api/grc/rollup — cockpit GRC consolidé sur le SOUS-ARBRE de l'organisation
// active (vue direction / groupe). Risque + plan d'action, plus — pour chaque
// module actif — incidents/pertes (LDC), contrôle permanent et audit interne.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  if (!scope.activeOrgId) return NextResponse.json({ active: false, orgs: [] })
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ active: false, orgs: [] })

  // Modules actifs pour l'organisation focalisée : on ne consolide que ce qui est
  // activé (les toggles se résolvent par organisation au point unique getOrgConfig).
  const withIncidents = orgConfig.incidentsActive
  const withControles = orgConfig.controlePermanentActive
  const withAudit = orgConfig.auditInterneActive
  const withKri = orgConfig.kriActive
  const withReglementaire = orgConfig.reglementaireActive

  // Périmètre : sous-arbre visible (SUPER_ADMIN non focalisé = toutes les orgs).
  const orgIds = scope.scope.visibleOrgIds
  const spansAll = scope.scope.isSuperAdmin && orgIds.length === 0
  const orgFilter = spansAll ? {} : { organizationId: { in: orgIds } }

  const [orgs, riskRows, actionRows, incidentRows, controleRows, executionRows, missionRows, constatRows, kriRows, doraRows] = await Promise.all([
    prisma.organization.findMany({
      where: spansAll ? {} : { id: { in: orgIds } },
      select: { id: true, nom: true },
    }),
    prisma.riskItem.findMany({
      where: orgFilter,
      select: {
        id: true, organizationId: true, taxonomieCode: true, processusId: true, entite: true, statut: true,
        graviteInherente: true, vraisemblanceInherente: true, graviteResiduelle: true, vraisemblanceResiduelle: true,
      },
    }),
    prisma.riskAction.findMany({
      where: orgFilter,
      select: { organizationId: true, riskItemId: true, statut: true, echeance: true },
    }),
    withIncidents
      ? prisma.incident.findMany({ where: orgFilter, select: { organizationId: true, statut: true, montantBrut: true, recuperations: true } })
      : Promise.resolve([]),
    withControles
      ? prisma.controle.findMany({ where: { ...orgFilter, actif: true }, select: { organizationId: true } })
      : Promise.resolve([]),
    withControles
      ? prisma.controleExecution.findMany({ where: orgFilter, select: { organizationId: true, resultat: true, dateRealisation: true } })
      : Promise.resolve([]),
    withAudit
      ? prisma.auditMission.findMany({ where: orgFilter, select: { organizationId: true } })
      : Promise.resolve([]),
    withAudit
      ? prisma.auditConstat.findMany({ where: orgFilter, select: { organizationId: true, criticite: true, statut: true, echeance: true } })
      : Promise.resolve([]),
    withKri
      ? prisma.kri.findMany({
          where: { ...orgFilter, actif: true },
          select: { organizationId: true, sens: true, seuilAlerte: true, seuilCritique: true, mesures: { orderBy: { dateMesure: 'desc' }, take: 1, select: { valeur: true } } },
        })
      : Promise.resolve([]),
    withReglementaire
      ? prisma.incident.findMany({ where: orgFilter, select: { organizationId: true, doraCriteres: true } })
      : Promise.resolve([]),
  ])

  // Filtres partagés avec la cartographie (même définition, cf. lib/risk-filters).
  // Ils ne s'appliquent qu'aux risques et à leurs actions ; les KPI des autres
  // modules restent à l'échelle du périmètre (leur maille n'est pas filtrable ici).
  const { searchParams } = new URL(req.url)
  const filters = parseFilters(searchParams)
  const enriched = riskRows.map(r => ({
    ...r,
    niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
  }))
  const kept = applyFilters(enriched, filters)
  const keptIds = new Set(kept.map(r => r.id))

  const risks: RiskLite[] = kept.map(r => ({
    organizationId: r.organizationId,
    niveauInherent: r.niveauInherent,
    niveauResiduel: r.niveauResiduel,
  }))
  const actions: ScopedAction[] = actionRows
    .filter(a => keptIds.has(a.riskItemId))
    .map(a => ({ organizationId: a.organizationId, statut: a.statut, echeance: a.echeance }))
  const now = new Date()

  // Normalisation des montants (Prisma Decimal → number) pour la LDC.
  const incidents: CockpitIncident[] = incidentRows.map(i => ({
    organizationId: i.organizationId,
    statut: i.statut as CockpitIncident['statut'],
    montantBrut: i.montantBrut == null ? null : Number(i.montantBrut),
    recuperations: i.recuperations == null ? null : Number(i.recuperations),
  }))
  const executions: CockpitExecution[] = executionRows.map(e => ({
    organizationId: e.organizationId, resultat: e.resultat, dateRealisation: e.dateRealisation,
  }))
  const constats: CockpitConstat[] = constatRows.map(c => ({
    organizationId: c.organizationId, criticite: c.criticite, statut: c.statut, echeance: c.echeance,
  }))

  // Appétit au risque : dépassements calculés sur les risques retenus (post-filtre).
  const appetit = cleanAppetitConfig(orgConfig.appetitRisque)
  const appetitDefini = appetit.seuilGlobal != null || Object.keys(appetit.parCategorie).length > 0
  const appetitRows: (RiskAppetitLite & { organizationId: string })[] = kept.map(r => ({
    organizationId: r.organizationId, taxonomieCode: r.taxonomieCode, niveauResiduel: r.niveauResiduel,
  }))
  const appetitByOrg = new Map<string, number>() // org → nb risques hors appétit
  if (appetitDefini) {
    const grouped = new Map<string, RiskAppetitLite[]>()
    for (const r of appetitRows) {
      const a = grouped.get(r.organizationId) ?? []
      a.push(r); grouped.set(r.organizationId, a)
    }
    for (const [org, rows] of grouped) appetitByOrg.set(org, synthetiserAppetit(rows, appetit).horsAppetit)
  }

  // KRI : statut courant de chaque KRI actif (dernière mesure vs seuils).
  const kriStatuts: { organizationId: string; statut: KriStatut }[] = kriRows.map(k => ({
    organizationId: k.organizationId,
    statut: evaluerKri(k.mesures[0]?.valeur ?? null, { sens: k.sens as KriSens, seuilAlerte: k.seuilAlerte, seuilCritique: k.seuilCritique }),
  }))
  const kriByOrg = new Map<string, number>() // org → nb KRI en alerte (alerte + critique)
  if (withKri) {
    const grouped = new Map<string, KriStatut[]>()
    for (const k of kriStatuts) {
      const a = grouped.get(k.organizationId) ?? []
      a.push(k.statut); grouped.set(k.organizationId, a)
    }
    for (const [org, statuts] of grouped) kriByOrg.set(org, synthetiserKri(statuts.map(statut => ({ statut }))).enAlerte)
  }

  // DORA : incidents TIC évalués majeurs (registre réglementaire).
  const doraByOrg = new Map<string, number>() // org → nb incidents majeurs
  const doraClasses: DoraClasse[] = []
  if (withReglementaire) {
    const grouped = new Map<string, DoraClasse[]>()
    for (const r of doraRows) {
      const criteres = (r.doraCriteres ?? {}) as DoraCriteres
      if (!estEvalueDora(criteres)) continue
      const classe = classifierIncident(criteres).classe
      doraClasses.push(classe)
      const a = grouped.get(r.organizationId) ?? []
      a.push(classe); grouped.set(r.organizationId, a)
    }
    for (const [org, classes] of grouped) doraByOrg.set(org, synthetiserDora(classes).majeurs)
  }

  // Cartes par organisation, fusionnées ensuite sur les lignes du registre.
  const incMap = withIncidents ? incidentsByOrg(incidents) : null
  const ctrlMap = withControles ? controlesByOrg(controleRows, executions) : null
  const audMap = withAudit ? auditByOrg(missionRows, constats, now) : null

  const parOrg = rollupByOrg(orgs, risks, actions, now).map(o => ({
    ...o,
    ...(incMap ? { incidents: incMap.get(o.orgId) ?? { total: 0, ouverts: 0, perteNette: 0 } } : {}),
    ...(ctrlMap ? { controles: ctrlMap.get(o.orgId) ?? { controles: 0, evaluees: 0, conformes: 0, anomalies: 0, tauxConformite: null } } : {}),
    ...(audMap ? { audit: audMap.get(o.orgId) ?? { missions: 0, constats: 0, critiques: 0, recosEnRetard: 0, tauxResolution: 0 } } : {}),
    ...(appetitDefini ? { horsAppetit: appetitByOrg.get(o.orgId) ?? 0 } : {}),
    ...(withKri ? { kriEnAlerte: kriByOrg.get(o.orgId) ?? 0 } : {}),
    ...(withReglementaire ? { doraMajeurs: doraByOrg.get(o.orgId) ?? 0 } : {}),
  }))

  return NextResponse.json({
    active: true,
    orgCount: orgs.length,
    modules: { incidents: withIncidents, controles: withControles, audit: withAudit, appetit: appetitDefini, kri: withKri, reglementaire: withReglementaire },
    consolide: {
      risques: rollupRisks(risks),
      actions: summarizeActions(actions, now),
      ...(withIncidents ? { incidents: rollupIncidents(incidents) } : {}),
      ...(withControles ? { controles: rollupControles(controleRows, executions) } : {}),
      ...(withAudit ? { audit: rollupAudit(missionRows, constats, now) } : {}),
      ...(appetitDefini ? { appetit: synthetiserAppetit(appetitRows, appetit) } : {}),
      ...(withKri ? { kri: synthetiserKri(kriStatuts.map(k => ({ statut: k.statut }))) } : {}),
      ...(withReglementaire ? { dora: synthetiserDora(doraClasses) } : {}),
    },
    parOrg,
  })
}
