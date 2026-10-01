import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { SECTOR_CODES, sanitizeSectorSelection, type SectorCode } from '@/lib/sector-suggestions'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Secteurs déclarés (ordre conservé : le premier est le principal) et secteurs disponibles ; ADMIN de l'organisation active. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = (session.user as { role?: UserRole }).role ?? 'ANALYSTE'
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId || !scope.role || !isAdminRole(scope.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const org = await prisma.organization.findUnique({ where: { id: scope.activeOrgId }, select: { secteursActivite: true } })
  const sectors = Array.isArray(org?.secteursActivite) ? org.secteursActivite.filter((s): s is SectorCode => SECTOR_CODES.includes(s as SectorCode)) : []
  return NextResponse.json({ sectors, available: SECTOR_CODES })
}

/** Secteurs déclarés par l'ADMIN, sans création automatique de données métier. */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = (session.user as { role?: UserRole }).role ?? 'ANALYSTE'
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId || !scope.role || !isAdminRole(scope.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const sectors = sanitizeSectorSelection(body.sectors)
  if (!sectors) return NextResponse.json({ error: 'invalid_sectors' }, { status: 400 })
  const org = await prisma.organization.update({ where: { id: scope.activeOrgId }, data: { secteursActivite: sectors }, select: { id: true, secteursActivite: true } })
  await auditLog('ORG_UPDATED', { userId, userRole: scope.role, organizationId: org.id, ip: getClientIp(req), details: { fields: ['secteursActivite'], sectors } })
  return NextResponse.json({ sectors: org.secteursActivite })
}
