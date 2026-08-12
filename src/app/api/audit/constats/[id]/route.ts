import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validateConstatInput, cleanConstatInput } from '@/lib/audit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function peutEcrireAudit(role: UserRole): boolean {
  return role === 'AUDITEUR' || isAdminRole(role)
}

async function loadInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const userRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const constat = await prisma.auditConstat.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true },
  })
  if (!constat) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const cfg = await getOrgConfig(constat.organizationId)
  if (!cfg.auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, constat }
}

// PATCH /api/audit/constats/[id] — modifier un constat / faire évoluer son suivi.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  if (!peutEcrireAudit(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateConstatInput(body, { partial: true })
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanConstatInput(body)

  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: c.constat.organizationId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  // Mise à jour PARTIELLE : on n'écrit que les champs présents dans le corps.
  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[]).filter(k => k in body).map(k => [k, data[k]]),
  ) as Partial<typeof data>

  const updated = await prisma.auditConstat.update({ where: { id }, data: partiel })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.constat.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-constat', action: 'update', id },
  })
  return NextResponse.json(updated)
}

// DELETE /api/audit/constats/[id] — supprimer un constat (auditeur / admin).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  if (!peutEcrireAudit(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  await prisma.auditConstat.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.constat.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-constat', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
}
