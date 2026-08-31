import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canManageRopa, type UserRole } from '@/lib/permissions'
import { sanitizeTraitement, evaluerTraitement } from '@/lib/ropa'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

async function loadOwned(orgId: string, id: string) {
  return db.traitement.findFirst({ where: { id, organizationId: orgId } })
}

// GET /api/ropa/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId || !canManageRopa(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const { id } = await params
  const t = await loadOwned(orgId, id)
  if (!t) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  return NextResponse.json({ ...t, evaluation: evaluerTraitement(sanitizeTraitement(t)) })
}

// PATCH /api/ropa/[id] — mettre à jour un traitement (DPO / ADMIN).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId || !canManageRopa(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const { id } = await params
  const existing = await loadOwned(orgId, id)
  if (!existing) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const t = sanitizeTraitement({ ...existing, ...body })
  if (!t.nom.trim()) return NextResponse.json({ error: 'nom_requis' }, { status: 400 })
  const { id: _drop, ...data } = t
  const updated = await db.traitement.update({ where: { id }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole, organizationId: orgId, ip: getClientIp(req), details: { scope: 'ropa', action: 'update', id } })
  return NextResponse.json(updated)
}

// DELETE /api/ropa/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId || !canManageRopa(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const { id } = await params
  const existing = await loadOwned(orgId, id)
  if (!existing) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  await db.traitement.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole, organizationId: orgId, ip: getClientIp(req), details: { scope: 'ropa', action: 'delete', id } })
  return NextResponse.json({ ok: true })
}
