import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { niveauRisque } from '@/lib/risk-item'
import { summarizeActions } from '@/lib/risk-action'
import { rollupRisks, rollupByOrg, type RiskLite, type ScopedAction } from '@/lib/grc-rollup'

export const dynamic = 'force-dynamic'

// GET /api/grc/rollup — consolidation risque + plan d'action sur le SOUS-ARBRE
// de l'organisation active (vue direction / groupe). Total + ventilation par entité.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  if (!scope.activeOrgId) return NextResponse.json({ active: false, orgs: [] })
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ active: false, orgs: [] })

  // Périmètre : sous-arbre visible (SUPER_ADMIN non focalisé = toutes les orgs).
  const orgIds = scope.scope.visibleOrgIds
  const orgFilter = scope.scope.isSuperAdmin && orgIds.length === 0 ? {} : { organizationId: { in: orgIds } }

  const [orgs, riskRows, actionRows] = await Promise.all([
    prisma.organization.findMany({
      where: scope.scope.isSuperAdmin && orgIds.length === 0 ? {} : { id: { in: orgIds } },
      select: { id: true, nom: true },
    }),
    prisma.riskItem.findMany({
      where: orgFilter,
      select: { organizationId: true, graviteInherente: true, vraisemblanceInherente: true, graviteResiduelle: true, vraisemblanceResiduelle: true },
    }),
    prisma.riskAction.findMany({
      where: orgFilter,
      select: { organizationId: true, statut: true, echeance: true },
    }),
  ])

  const risks: RiskLite[] = riskRows.map(r => ({
    organizationId: r.organizationId,
    niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
  }))
  const actions: ScopedAction[] = actionRows.map(a => ({ organizationId: a.organizationId, statut: a.statut, echeance: a.echeance }))
  const now = new Date()

  return NextResponse.json({
    active: true,
    orgCount: orgs.length,
    consolide: { risques: rollupRisks(risks), actions: summarizeActions(actions, now) },
    parOrg: rollupByOrg(orgs, risks, actions, now),
  })
}
