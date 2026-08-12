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

  // Périmètre : sous-arbre visible (SUPER_ADMIN non focalisé = toutes les orgs).
  const orgIds = scope.scope.visibleOrgIds
  const spansAll = scope.scope.isSuperAdmin && orgIds.length === 0
  const orgFilter = spansAll ? {} : { organizationId: { in: orgIds } }

  const [orgs, riskRows, actionRows, incidentRows, controleRows, executionRows, missionRows, constatRows] = await Promise.all([
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

  // Cartes par organisation, fusionnées ensuite sur les lignes du registre.
  const incMap = withIncidents ? incidentsByOrg(incidents) : null
  const ctrlMap = withControles ? controlesByOrg(controleRows, executions) : null
  const audMap = withAudit ? auditByOrg(missionRows, constats, now) : null

  const parOrg = rollupByOrg(orgs, risks, actions, now).map(o => ({
    ...o,
    ...(incMap ? { incidents: incMap.get(o.orgId) ?? { total: 0, ouverts: 0, perteNette: 0 } } : {}),
    ...(ctrlMap ? { controles: ctrlMap.get(o.orgId) ?? { controles: 0, evaluees: 0, conformes: 0, anomalies: 0, tauxConformite: null } } : {}),
    ...(audMap ? { audit: audMap.get(o.orgId) ?? { missions: 0, constats: 0, critiques: 0, recosEnRetard: 0, tauxResolution: 0 } } : {}),
  }))

  return NextResponse.json({
    active: true,
    orgCount: orgs.length,
    modules: { incidents: withIncidents, controles: withControles, audit: withAudit },
    consolide: {
      risques: rollupRisks(risks),
      actions: summarizeActions(actions, now),
      ...(withIncidents ? { incidents: rollupIncidents(incidents) } : {}),
      ...(withControles ? { controles: rollupControles(controleRows, executions) } : {}),
      ...(withAudit ? { audit: rollupAudit(missionRows, constats, now) } : {}),
    },
    parOrg,
  })
}
