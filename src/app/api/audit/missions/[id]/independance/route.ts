import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withAccess } from '@/lib/with-access.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutEcrireAudit } from '@/lib/audit-acces'
import { cleanIndependance } from '@/lib/audit-l4'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/audit/missions/[id]/independance — déclaration d'indépendance / de conflit d'intérêts,
// tracée (auteur, date). Réservé à l'audit.
// Mission cherchée dans le périmètre visible, sans organisation active exigée : `org: 'none'`.
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'audit-independance' } }, async (req, { user, params: { id } }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({ where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) }, select: { id: true, organizationId: true } })
  if (!mission) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const role = await roleSurRessource(userId, user.role, mission.organizationId)
  if (!(await getOrgConfig(mission.organizationId)).auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutEcrireAudit(role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const decl = cleanIndependance(body, { auteur: userId, now: new Date() })
  if (!decl) return NextResponse.json({ error: 'commentaire_requis' }, { status: 400 })
  const updated = await prisma.auditMission.update({ where: { id }, data: { independance: decl as unknown as Prisma.InputJsonValue } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole: role, organizationId: mission.organizationId, ip: getClientIp(req), details: { scope: 'audit', action: 'independance', id, conflit: decl.conflit } })
  return NextResponse.json(updated)
})
