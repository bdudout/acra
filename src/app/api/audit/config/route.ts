import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withAccess } from '@/lib/with-access.server'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole } from '@/lib/permissions'
import { resolveAuditConfig, sanitizeAuditConfig } from '@/lib/audit-config'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/audit/config — paramétrage effectif (rappels, cycles de couverture).
// Sans organisation active : { active: false } (pas de 400) — d'où `org: 'none'`.
export const GET = withAccess({ org: 'none' }, async (_req, { user }) => {
  const scope = await getAnalyseScope(user.id, user.role)
  if (!scope.activeOrgId) return NextResponse.json({ active: false })
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.auditInterneActive) return NextResponse.json({ active: false })
  return NextResponse.json({ active: true, canEdit: isAdminRole(scope.role), config: resolveAuditConfig(cfg.auditConfig) })
})

// PUT /api/audit/config — ADMIN de l'organisation uniquement.
// Module vérifié AVANT le rôle (ordre conservé) : le contrôle de rôle reste dans le handler.
export const PUT = withAccess({ org: 'active', rateLimit: { bucket: 'audit-config' } }, async (req, { user, role, orgId }) => {
  if (!(await getOrgConfig(orgId)).auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!isAdminRole(role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const config = sanitizeAuditConfig(await req.json().catch(() => null))
  const json = config as unknown as Prisma.InputJsonValue
  await upsertOrgConfig(orgId, { auditConfig: json })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'audit', action: 'config' } })
  return NextResponse.json({ config })
})
