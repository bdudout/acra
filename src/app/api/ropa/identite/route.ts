// ─── Registre des traitements : identité du responsable (RGPD art. 30 §1 a) ───
// GET : saisie de l'organisation active + DPO désignés dans ACRA (repris automatiquement) + identité effective.
// PUT : enregistre la saisie (responsable, représentant, DPO en champ libre). DPO / ADMIN ; journalisé.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canManageRopa, type UserRole } from '@/lib/permissions'
import { sanitizeIdentite } from '@/lib/ropa-identite'
import { lireIdentite } from '@/lib/ropa-identite.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function contexte() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const user = session.user as { id: string; role?: string }
  const scope = await getAnalyseScope(user.id, (user.role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  if (!canManageRopa(scope.role as UserRole)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { userId: user.id, role: scope.role, orgId: scope.activeOrgId }
}

export async function GET(): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error!
  return NextResponse.json(await lireIdentite(c.orgId))
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error!
  const saisie = sanitizeIdentite(await req.json().catch(() => ({})))
  await prisma.ropaIdentite.upsert({ where: { organizationId: c.orgId }, create: { organizationId: c.orgId, ...saisie }, update: saisie })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'ropa-identite', action: 'update' } })
  return NextResponse.json(await lireIdentite(c.orgId))
}
