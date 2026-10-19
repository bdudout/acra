import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canManageRopa } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { type SessionUser } from '@/lib/route-guard.server'
import { sanitizeDateRevue } from '@/lib/revues'
import { sanitizeTraitement, evaluerTraitement } from '@/lib/ropa'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// Sans organisation active, la route répond 403 (et non 400) : org active résolue ici, `org: 'none'`.
async function ctx(user: SessionUser) {
  const scope = await getAnalyseScope(user.id, user.role)
  return { userId: user.id, userRole: scope.role, orgId: scope.activeOrgId }
}

async function loadOwned(orgId: string, id: string) {
  return db.traitement.findFirst({ where: { id, organizationId: orgId } })
}

// GET /api/ropa/[id]
export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id } }) => {
  const { userRole, orgId } = await ctx(user)
  if (!orgId || !canManageRopa(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const t = await loadOwned(orgId, id)
  if (!t) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  return NextResponse.json({ ...t, evaluation: evaluerTraitement(sanitizeTraitement(t)) })
})

// PATCH /api/ropa/[id] — mettre à jour un traitement (DPO / ADMIN).
export const PATCH = withAccess({ org: 'none', rateLimit: { bucket: 'ropa' } }, async (req, { user, params: { id } }) => {
  const { userId, userRole, orgId } = await ctx(user)
  if (!orgId || !canManageRopa(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const existing = await loadOwned(orgId, id)
  if (!existing) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const t = sanitizeTraitement({ ...existing, ...body })
  if (!t.nom.trim()) return NextResponse.json({ error: 'nom_requis' }, { status: 400 })
  const { id: _drop, ...data } = t
  // Revue périodique (lib/revues) : date de dernière revue saisie par le DPO ; invalide ou future → ignorée.
  const derniereRevue = sanitizeDateRevue((body as { derniereRevue?: unknown }).derniereRevue, new Date())
  const updated = await db.traitement.update({ where: { id }, data: { ...data, ...(derniereRevue !== undefined ? { derniereRevue } : {}) } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole, organizationId: orgId, ip: getClientIp(req), details: { scope: 'ropa', action: 'update', id } })
  return NextResponse.json(updated)
})

// DELETE /api/ropa/[id]
export const DELETE = withAccess({ org: 'none', rateLimit: { bucket: 'ropa' } }, async (req, { user, params: { id } }) => {
  const { userId, userRole, orgId } = await ctx(user)
  if (!orgId || !canManageRopa(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const existing = await loadOwned(orgId, id)
  if (!existing) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  await db.traitement.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole, organizationId: orgId, ip: getClientIp(req), details: { scope: 'ropa', action: 'delete', id } })
  return NextResponse.json({ ok: true })
})
