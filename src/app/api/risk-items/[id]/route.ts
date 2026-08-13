import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { type UserRole } from '@/lib/permissions'
import { validateRiskItemInput, cleanRiskItem } from '@/lib/risk-item'
import { auditLog, getClientIp } from '@/lib/logger'

type Params = { params: Promise<{ id: string }> }

// Charge le risque dans le périmètre de l'utilisateur (tout rôle sauf LECTEUR).
async function loadInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (userRole === 'LECTEUR') return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const r = await prisma.riskItem.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true },
  })
  if (!r) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  return { userId, userRole, orgId: r.organizationId }
}

// PATCH /api/risk-items/[id] — mettre à jour un risque.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const ctx = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in ctx) return ctx.error

  const body = await req.json().catch(() => ({}))
  const erreur = validateRiskItemInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanRiskItem(body)
  if (data.processusId) {
    const p = await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: ctx.orgId }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  // La provenance (traçabilité) ne se modifie pas via l'édition manuelle.
  const { ...rest } = data
  const updated = await prisma.riskItem.update({ where: { id }, data: rest })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'risk-item', action: 'update', id } })
  return NextResponse.json(updated)
}

// DELETE /api/risk-items/[id] — supprimer un risque.
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const ctx = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in ctx) return ctx.error
  await prisma.riskItem.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'risk-item', action: 'delete', id } })
  return NextResponse.json({ ok: true })
}
