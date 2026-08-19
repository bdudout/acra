import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { cleanArrangementInput, validateArrangementInput } from '@/lib/registre-tic'
import { peutGererRegistreTic } from '../route'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

async function scopeGuard(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return { error: NextResponse.json({ error: 'org_absente' }, { status: 400 }) }
  const cfg = await getOrgConfig(orgId)
  if (!cfg.reglementaireActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 403 }) }
  if (!peutGererRegistreTic(scope.role)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const row = await prisma.arrangementTic.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
  if (!row) return { error: NextResponse.json({ error: 'introuvable' }, { status: 404 }) }
  return { userId, userRole: scope.role, orgId }
}

// PATCH /api/reglementaire/registre-tic/[id] — met à jour un arrangement (remplacement).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await scopeGuard(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in g) return g.error

  const body = await req.json().catch(() => ({}))
  const erreur = validateArrangementInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanArrangementInput(body)

  const updated = await prisma.arrangementTic.update({ where: { id }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: g.userId, userRole: g.userRole, organizationId: g.orgId, ip: getClientIp(req),
    details: { scope: 'registre-tic', action: 'update', id },
  })
  return NextResponse.json(updated)
}

// DELETE /api/reglementaire/registre-tic/[id] — supprime un arrangement.
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await scopeGuard(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in g) return g.error

  await prisma.arrangementTic.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: g.userId, userRole: g.userRole, organizationId: g.orgId, ip: getClientIp(req),
    details: { scope: 'registre-tic', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
}
