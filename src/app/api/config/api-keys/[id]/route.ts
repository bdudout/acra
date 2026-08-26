import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/config/api-keys/[id] — révoque une clé (ADMIN, organisation active).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!isAdminRole(scope.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const { id } = await params

  // Ne révoque qu'une clé de l'organisation active (isolation).
  const key = await prisma.apiKey.findFirst({ where: { id, organizationId: scope.activeOrgId ?? '' }, select: { id: true, revokedAt: true } })
  if (!key) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!key.revokedAt) {
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
  }
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: scope.role, organizationId: scope.activeOrgId ?? undefined, ip: getClientIp(req),
    details: { scope: 'api-key', action: 'revoke', id },
  })
  return NextResponse.json({ ok: true })
}
