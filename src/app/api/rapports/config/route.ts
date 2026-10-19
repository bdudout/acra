import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { peutLireRapports } from '@/lib/rapport-acces'
import { sanitizeRapportsConfig } from '@/lib/rapport-masquage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/rapports/config — gabarits surchargés (titre, introduction, sections masquées) de l'organisation.
export const GET = withAccess({ org: 'active', allow: peutLireRapports }, async (_req, { role, orgId }) => {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.rapportsGrcActive) return NextResponse.json({ error: 'module_inactif' }, { status: 404 })
  return NextResponse.json({ canEdit: isAdminRole(role), config: sanitizeRapportsConfig(cfg.rapportsConfig) })
})

// PUT /api/rapports/config — ADMIN de l'organisation uniquement.
export const PUT = withAccess({ org: 'active', allow: isAdminRole, rateLimit: { bucket: 'rapports-config' } }, async (req, { user, role, orgId }) => {
  const config = sanitizeRapportsConfig(await req.json().catch(() => null))
  const json = config as unknown as Prisma.InputJsonValue
  await upsertOrgConfig(orgId, { rapportsConfig: json })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'rapport', action: 'config' } })
  return NextResponse.json({ config })
})
