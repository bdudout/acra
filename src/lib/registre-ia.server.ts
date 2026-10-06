// ─── Registre IA : contexte et garde communs aux routes /api/registre-ia ──────
// Session, organisation active, rôle effectif (gouvernance : peutGererRegistreIa), module actif (registreIaActive,
// politique d'instance comprise) ; analyses de l'organisation que l'utilisateur peut ouvrir (lien analyse / AIPD).
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseWhereClause, peutGererRegistreIa, type OrgScopeContext, type UserRole } from '@/lib/permissions'

export interface IaCtx { userId: string; role: UserRole; orgId: string; scope: OrgScopeContext }

export async function iaContext(): Promise<{ ctx: IaCtx } | { error: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'organization_required' }, { status: 400 }) }
  if (!peutGererRegistreIa(scope.role)) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  if (!(await getOrgConfig(scope.activeOrgId)).registreIaActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 404 }) }
  return { ctx: { userId, role: scope.role, orgId: scope.activeOrgId, scope: scope.scope } }
}

/** Analyses de l'organisation active ouvrables par l'utilisateur (choix du lien ; contrôle à l'enregistrement). */
export async function analysesLiables(ctx: IaCtx): Promise<{ id: string; nom: string }[]> {
  return prisma.analyse.findMany({
    where: { AND: [analyseWhereClause(ctx.userId, ctx.role, ctx.scope), { organizationId: ctx.orgId }] },
    select: { id: true, nom: true }, orderBy: { nom: 'asc' }, take: 500,
  })
}
