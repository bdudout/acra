import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { resolveEchelles, type EchellesEcosysteme } from '@/lib/ecosystem-echelles'
import { coterEvaluation, sanitizeEvaluationTiers } from '@/lib/tier-evaluation'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/risk-items/[id]/tiers — vue inverse de l'évaluation des tiers : services tiers dont l'évaluation est rattachée à
 * ce risque (risque d'externalisation), avec statut, zone actuelle et cible. Risque dans le périmètre de l'utilisateur,
 * évaluations de la même organisation que le risque.
 */
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const user = session.user as { id: string; role?: string }
  const scope = await getAnalyseScope(user.id, (user.role ?? 'ANALYSTE') as UserRole)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const risk = await prisma.riskItem.findFirst({ where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) }, select: { id: true, organizationId: true } })
  if (!risk) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const cfg = await getOrgConfig(risk.organizationId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  const echelles = resolveEchelles(cfg.echellesEcosysteme as Partial<EchellesEcosysteme> | null)
  const evals = await prisma.evaluationUsageTiers.findMany({
    where: { organizationId: risk.organizationId, risqueIds: { array_contains: [risk.id] } },
    select: { statut: true, actuelle: true, cible: true, usage: { select: { useCase: true, tierService: { select: { nom: true, tier: { select: { nom: true } } } } } } },
    take: 200,
  })
  const brief = (n: { menace: number; zone: string } | null) => (n ? { menace: n.menace, zone: n.zone } : null)
  return NextResponse.json({
    services: evals.map(e => {
      const c = coterEvaluation(sanitizeEvaluationTiers({ actuelle: e.actuelle, cible: e.cible }, echelles), echelles)
      return { tiers: e.usage.tierService.tier.nom, offre: e.usage.tierService.nom, usage: e.usage.useCase, statut: e.statut, actuelle: brief(c.actuelle), cible: brief(c.cible) }
    }),
  })
}
