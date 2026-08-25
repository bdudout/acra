import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { validateControleInput, cleanControleInput } from '@/lib/controle'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function peutDefinir(role: UserRole, secondeLigneActive: boolean): boolean {
  return peutDefinir2eLigne(role, { secondeLigneActive })
}

async function loadInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const controle = await prisma.controle.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true },
  })
  if (!controle) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const cfg = await getOrgConfig(controle.organizationId)
  if (!cfg.controlePermanentActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, orgId: controle.organizationId, secondeLigneActive: cfg.secondeLigneActive }
}

// PATCH /api/controles/[id] — modifier un contrôle (2ᵉ ligne). Mise à jour PARTIELLE.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  if (!peutDefinir(c.userRole, c.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateControleInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanControleInput(body)

  if (data.processusId) {
    const p = await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: c.orgId }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: c.orgId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  // N'écrire que les champs présents (un PATCH ne doit rien effacer par omission).
  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[]).filter(k => k in body).map(k => [k, data[k]]),
  ) as Partial<typeof data>

  const updated = await prisma.controle.update({ where: { id }, data: partiel })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.orgId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'update', id },
  })
  return NextResponse.json(updated)
}

// DELETE /api/controles/[id] — supprimer un contrôle et son historique (2ᵉ ligne).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  if (!peutDefinir(c.userRole, c.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  await prisma.controle.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.orgId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
}
