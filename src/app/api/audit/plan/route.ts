import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { planPluriannuel } from '@/lib/audit-l4'
import { resolveAuditConfig } from '@/lib/audit-config'

export const dynamic = 'force-dynamic'

// GET /api/audit/plan?horizon=3 — plan d'audit pluriannuel : couverture de l'univers, retards, plan par année.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return NextResponse.json({ active: false })
  const orgCfg = await getOrgConfig(scope.activeOrgId)
  if (!orgCfg.auditInterneActive) return NextResponse.json({ active: false })
  const h = Number(new URL(req.url).searchParams.get('horizon'))
  const horizonAns = Number.isInteger(h) && h >= 1 && h <= 5 ? h : 3
  const [univers, missions] = await Promise.all([
    prisma.auditUnivers.findMany({ where: { organizationId: scope.activeOrgId }, orderBy: [{ risque: 'desc' }, { intitule: 'asc' }], take: 500 }),
    prisma.auditMission.findMany({ where: { organizationId: scope.activeOrgId }, select: { id: true, intitule: true, statut: true, dateDebut: true, dateFin: true, processusIds: true, universIds: true }, take: 2000 }),
  ])
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const plan = planPluriannuel(univers, missions.map(m => ({ ...m, processusIds: arr(m.processusIds), universIds: arr(m.universIds) })), new Date(), { horizonAns, cycles: resolveAuditConfig(orgCfg.auditConfig).cycles })
  return NextResponse.json({ active: true, plan, univers })
}
