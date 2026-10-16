import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getAdminOrgIds } from '@/lib/org-context.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { withAccess } from '@/lib/with-access.server'

// Filtre d'organisation pour la corbeille (SUPER_ADMIN : tout ; sinon son périmètre).
async function recoveryOrgFilter(userId: string, userRole: UserRole) {
  const { all, ids } = await getAdminOrgIds(userId, userRole)
  return all ? {} : { organizationId: { in: ids } }
}

// Corbeille : réservée aux administrateurs (rôle d'instance, `canAdmin`).
const ADMIN = { org: 'none', allow: isAdminRole, rateLimit: { bucket: 'admin-recovery' } } as const

// PATCH /api/admin/recovery/:id — restaurer une analyse de la corbeille (ADMIN).
export const PATCH = withAccess(ADMIN, async (req, { user, params }) => {
  const { id } = params

  const a = await prisma.analyse.findFirst({ where: { id, ...(await recoveryOrgFilter(user.id, user.role)) }, select: { id: true, nom: true, deletedAt: true } })
  if (!a || !a.deletedAt) return NextResponse.json({ error: 'Analyse introuvable dans la corbeille' }, { status: 404 })

  await prisma.analyse.update({ where: { id }, data: { deletedAt: null, deletedById: null } })
  await auditLog('ANALYSE_RESTORED', {
    userId: user.id, userRole: user.role,
    targetId: id, targetType: 'analyse', ip: getClientIp(req),
    details: { nom: a.nom },
  })
  return NextResponse.json({ ok: true })
})

// DELETE /api/admin/recovery/:id — purge définitive (ADMIN). Cascade sur les ateliers.
export const DELETE = withAccess(ADMIN, async (req, { user, params }) => {
  const { id } = params

  const a = await prisma.analyse.findFirst({ where: { id, ...(await recoveryOrgFilter(user.id, user.role)) }, select: { id: true, nom: true, deletedAt: true } })
  if (!a || !a.deletedAt) return NextResponse.json({ error: 'Analyse introuvable dans la corbeille' }, { status: 404 })

  await prisma.analyse.delete({ where: { id } })
  await auditLog('ANALYSE_PURGED', {
    userId: user.id, userRole: user.role,
    targetId: id, targetType: 'analyse', ip: getClientIp(req),
    details: { nom: a.nom },
  })
  return NextResponse.json({ ok: true })
})
