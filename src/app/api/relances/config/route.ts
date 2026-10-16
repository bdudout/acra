import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { sanitizeRelancesConfig } from '@/lib/relances'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/relances/config — paramétrage effectif des relances (questionnaires, préconisations, plans d'action).
export const GET = withAccess({ org: 'active' }, async (_req, { role, orgId }) => {
  const cfg = await getOrgConfig(orgId)
  return NextResponse.json({ canEdit: isAdminRole(role), config: sanitizeRelancesConfig(cfg.relancesConfig) })
})

// PUT /api/relances/config — ADMIN de l'organisation (rôle effectif) uniquement.
export const PUT = withAccess({ org: 'active', allow: isAdminRole, rateLimit: { bucket: 'relances' } }, async (req, { user, role, orgId }) => {
  const config = sanitizeRelancesConfig(await req.json().catch(() => null))
  const json = config as unknown as Prisma.InputJsonValue
  await upsertOrgConfig(orgId, { relancesConfig: json })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'relances', action: 'config', ...config } })
  return NextResponse.json({ config })
})
