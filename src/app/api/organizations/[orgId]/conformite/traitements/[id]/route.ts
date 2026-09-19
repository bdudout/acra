/**
 * Un traitement de conformité : mise à jour (dont rattachement/retrait d'une
 * exigence via addRef/removeRef) et suppression. Réservé à la gouvernance.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { sanitizeRefs, TRAITEMENT_STATUTS } from '@/lib/conformite-traitement'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string; id: string }> }

function canManage(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER'
}

async function guard(orgId: string, id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const role = await getEffectiveRoleForOrg(userId, instanceRole, orgId)
  if (!role || !canManage(role)) return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  const row = await prisma.conformiteTraitement.findFirst({ where: { id, organizationId: orgId }, select: { id: true, refs: true } })
  if (!row) return { error: NextResponse.json({ error: 'Traitement introuvable' }, { status: 404 }) }
  return { userId, row }
}

// PATCH /api/organizations/[orgId]/conformite/traitements/[id] — met à jour un traitement d'écart de conformité (plan d'action / dérogation / acceptation).
export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgId, id } = await params
  const g = await guard(orgId, id)
  if ('error' in g) return g.error
  const body = await req.json().catch(() => ({}))

  const data: Prisma.ConformiteTraitementUpdateInput = {}
  if (typeof body?.intitule === 'string' && body.intitule.trim()) data.intitule = body.intitule.trim().slice(0, 200)
  if (typeof body?.description === 'string') data.description = body.description.trim().slice(0, 4000) || null
  if (typeof body?.responsable === 'string') data.responsable = body.responsable.trim().slice(0, 120) || null
  if (typeof body?.echeance === 'string') { const d = new Date(body.echeance); data.echeance = body.echeance && !isNaN(d.getTime()) ? d : null }
  if (typeof body?.statut === 'string' && (TRAITEMENT_STATUTS as string[]).includes(body.statut)) data.statut = body.statut
  if (typeof body?.niveauRisqueMaintenu === 'boolean') data.niveauRisqueMaintenu = body.niveauRisqueMaintenu
  if (typeof body?.niveauRisque === 'string') data.niveauRisque = body.niveauRisque.trim().slice(0, 60) || null

  // Rattachement / retrait d'exigences (refs) — cœur du multi-contrôles.
  const current = sanitizeRefs(g.row.refs)
  if (typeof body?.addRef === 'string' && body.addRef.trim()) {
    data.refs = sanitizeRefs([...current, body.addRef]) as unknown as Prisma.InputJsonValue
  } else if (typeof body?.removeRef === 'string' && body.removeRef.trim()) {
    data.refs = current.filter(r => r !== body.removeRef.trim()) as unknown as Prisma.InputJsonValue
  } else if (Array.isArray(body?.refs)) {
    data.refs = sanitizeRefs(body.refs) as unknown as Prisma.InputJsonValue
  }

  const updated = await prisma.conformiteTraitement.update({
    where: { id }, data,
    select: { id: true, type: true, intitule: true, refs: true, statut: true },
  })
  return NextResponse.json({ traitement: updated })
}

// DELETE /api/organizations/[orgId]/conformite/traitements/[id] — supprime un traitement d'écart de conformité.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { orgId, id } = await params
  const g = await guard(orgId, id)
  if ('error' in g) return g.error
  await prisma.conformiteTraitement.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
