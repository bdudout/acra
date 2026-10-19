import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { withAccess } from '@/lib/with-access.server'
import { type SessionUser } from '@/lib/route-guard.server'
import { validateRiskItemInput, cleanRiskItem } from '@/lib/risk-item'
import { auditLog, getClientIp } from '@/lib/logger'
import { entiteIdPourTexte } from '@/lib/entites.server'

// `org: 'none'` : le risque est cherché dans tout le périmètre visible (SUPER_ADMIN non focalisé inclus).
const access = { org: 'none', rateLimit: { bucket: 'risk-items' } } as const

// Charge le risque dans le périmètre de l'utilisateur (tout rôle sauf LECTEUR).
async function loadInScope(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const r = await prisma.riskItem.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true },
  })
  if (!r) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const userRole = await roleSurRessource(userId, user.role, r.organizationId)
  if (userRole === 'LECTEUR') return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { error: null, userId, userRole, orgId: r.organizationId }
}

// PATCH /api/risk-items/[id] — mettre à jour un risque.
export const PATCH = withAccess(access, async (req, { user, params: { id } }) => {
  const ctx = await loadInScope(user, id)
  if (ctx.error) return ctx.error

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
  // Lien au référentiel recalculé à partir du texte « entité » (identique) ou retiré (consolidation des entités).
  const updated = await prisma.riskItem.update({ where: { id }, data: { ...rest, entiteId: await entiteIdPourTexte(ctx.orgId, rest.entite) } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'risk-item', action: 'update', id } })
  return NextResponse.json(updated)
})

// DELETE /api/risk-items/[id] — supprimer un risque.
export const DELETE = withAccess(access, async (req, { user, params: { id } }) => {
  const ctx = await loadInScope(user, id)
  if (ctx.error) return ctx.error
  await prisma.riskItem.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'risk-item', action: 'delete', id } })
  return NextResponse.json({ ok: true })
})
