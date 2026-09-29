import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutEcrireAudit } from '@/lib/audit-acces'
import { cleanUniversInput } from '@/lib/audit-l4'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function contexte(): Promise<{ error: NextResponse } | { userId: string; role: UserRole; orgId: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  return { userId, role: scope.role as UserRole, orgId: scope.activeOrgId }
}

// GET /api/audit/univers — univers d'audit de l'organisation active (lecture ouverte).
export async function GET(): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!(await getOrgConfig(c.orgId)).auditInterneActive) return NextResponse.json({ active: false, univers: [] })
  const univers = await prisma.auditUnivers.findMany({ where: { organizationId: c.orgId }, orderBy: [{ risque: 'desc' }, { intitule: 'asc' }], take: 500 })
  return NextResponse.json({ active: true, canWrite: peutEcrireAudit(c.role), univers })
}

// POST /api/audit/univers — ajouter une entrée (auditeur / admin).
export async function POST(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!(await getOrgConfig(c.orgId)).auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutEcrireAudit(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const data = cleanUniversInput(body)
  if (!data.intitule) return NextResponse.json({ error: 'intitule_requis' }, { status: 400 })
  if (data.processusId && !(await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: c.orgId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  const univers = await prisma.auditUnivers.create({ data: { ...data, organizationId: c.orgId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'audit', action: 'univers:create', id: univers.id } })
  return NextResponse.json(univers, { status: 201 })
}
