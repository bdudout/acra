import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'
import { SECTOR_CODES, sanitizeSectorSelection, type SectorCode } from '@/lib/sector-suggestions'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Organisation active administrée par l'utilisateur, ou null (403 sans organisation active, comme sans droit). */
async function orgAdministree(user: SessionUser) {
  const scope = await getAnalyseScope(user.id, user.role)
  if (!scope.activeOrgId || !scope.role || !isAdminRole(scope.role)) return null
  return { orgId: scope.activeOrgId, role: scope.role }
}
const interdit = () => NextResponse.json({ error: 'forbidden' }, { status: 403 })

/** Secteurs déclarés (ordre conservé : le premier est le principal) et secteurs disponibles ; ADMIN de l'organisation active. */
export const GET = withAccess({ org: 'none' }, async (_req, { user }) => {
  const admin = await orgAdministree(user)
  if (!admin) return interdit()
  const org = await prisma.organization.findUnique({ where: { id: admin.orgId }, select: { secteursActivite: true } })
  const sectors = Array.isArray(org?.secteursActivite) ? org.secteursActivite.filter((s): s is SectorCode => SECTOR_CODES.includes(s as SectorCode)) : []
  return NextResponse.json({ sectors, available: SECTOR_CODES })
})

/** Secteurs déclarés par l'ADMIN, sans création automatique de données métier. */
export const PUT = withAccess({ org: 'none', rateLimit: { bucket: 'catalogue-sectors' } }, async (req, { user }) => {
  const admin = await orgAdministree(user)
  if (!admin) return interdit()
  const body = await req.json().catch(() => ({}))
  const sectors = sanitizeSectorSelection(body.sectors)
  if (!sectors) return NextResponse.json({ error: 'invalid_sectors' }, { status: 400 })
  const org = await prisma.organization.update({ where: { id: admin.orgId }, data: { secteursActivite: sectors }, select: { id: true, secteursActivite: true } })
  await auditLog('ORG_UPDATED', { userId: user.id, userRole: admin.role, organizationId: org.id, ip: getClientIp(req), details: { fields: ['secteursActivite'], sectors } })
  return NextResponse.json({ sectors: org.secteursActivite })
})
