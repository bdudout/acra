import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutEcrireAudit } from '@/lib/audit-acces'
import { cleanUniversInput } from '@/lib/audit-l4'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Entrée cherchée dans le périmètre visible, sans organisation active exigée : `org: 'none'` ;
// 404 et module avant le contrôle de rôle (ordre conservé).
const ACCESS = { org: 'none', rateLimit: { bucket: 'audit-univers' } } as const

async function charger(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const entree = await prisma.auditUnivers.findFirst({ where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) }, select: { id: true, organizationId: true } })
  if (!entree) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  if (!(await getOrgConfig(entree.organizationId)).auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const role = await roleSurRessource(userId, user.role, entree.organizationId)
  if (!peutEcrireAudit(role)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { userId, role, entree }
}

export const PATCH = withAccess(ACCESS, async (req, { user, params: { id } }) => {
  const c = await charger(user, id)
  if ('error' in c) return c.error as NextResponse
  const body = await req.json().catch(() => ({}))
  const data = cleanUniversInput(body)
  if (!data.intitule) return NextResponse.json({ error: 'intitule_requis' }, { status: 400 })
  if (data.processusId && !(await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: c.entree.organizationId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  const updated = await prisma.auditUnivers.update({ where: { id }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.entree.organizationId, ip: getClientIp(req), details: { scope: 'audit', action: 'univers:update', id } })
  return NextResponse.json(updated)
})

export const DELETE = withAccess(ACCESS, async (req, { user, params: { id } }) => {
  const c = await charger(user, id)
  if ('error' in c) return c.error as NextResponse
  await prisma.auditUnivers.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.entree.organizationId, ip: getClientIp(req), details: { scope: 'audit', action: 'univers:delete', id } })
  return NextResponse.json({ ok: true })
})
