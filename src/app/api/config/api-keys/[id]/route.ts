import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// DELETE /api/config/api-keys/[id] — révoque une clé (ADMIN, organisation active).
// org: 'none' : sans organisation active, la route répond 404 (aucune clé) et non 400.
export const DELETE = withAccess({ org: 'none', rateLimit: { bucket: 'api-keys' } }, async (req, { user, params: { id } }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  if (!isAdminRole(scope.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

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
})
