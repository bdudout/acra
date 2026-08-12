import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { validateKriInput, cleanKriInput, evaluerKri, tendanceKri, type KriSens } from '@/lib/kri'
import { peutDefinirKri } from '../route'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

async function loadInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const userRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  const orgIds = scope.scope.visibleOrgIds
  const spansAll = scope.scope.isSuperAdmin && orgIds.length === 0
  const kri = await prisma.kri.findFirst({
    where: { id, ...(spansAll ? {} : { organizationId: { in: orgIds } }) },
    select: { id: true, organizationId: true },
  })
  if (!kri) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const cfg = await getOrgConfig(kri.organizationId)
  if (!cfg.kriActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, kri }
}

// GET /api/kri/[id] — détail + historique des mesures + statut/tendance.
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error

  const kri = await prisma.kri.findUnique({
    where: { id },
    include: {
      mesures: { orderBy: { dateMesure: 'desc' }, select: { id: true, valeur: true, dateMesure: true, commentaire: true } },
      riskItem: { select: { intitule: true } },
    },
  })
  if (!kri) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { mesures, riskItem, ...entete } = kri
  const derniere = mesures[0]?.valeur ?? null
  const precedente = mesures[1]?.valeur ?? null
  return NextResponse.json({
    kri: { ...entete, riskIntitule: riskItem?.intitule ?? null },
    mesures,
    statut: evaluerKri(derniere, { sens: kri.sens as KriSens, seuilAlerte: kri.seuilAlerte, seuilCritique: kri.seuilCritique }),
    tendance: tendanceKri(derniere, precedente, kri.sens as KriSens),
  })
}

// PATCH /api/kri/[id] — modifier la définition (gouvernance).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  if (!peutDefinirKri(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateKriInput(body, { partial: true })
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanKriInput(body)

  if ('riskItemId' in body && data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: c.kri.organizationId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  // Mise à jour PARTIELLE : on n'écrit que les champs présents dans le corps.
  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[]).filter(k => k in body).map(k => [k, data[k]]),
  ) as Partial<typeof data>

  const updated = await prisma.kri.update({ where: { id }, data: partiel })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.kri.organizationId, ip: getClientIp(req),
    details: { scope: 'kri', action: 'update', id },
  })
  return NextResponse.json(updated)
}

// DELETE /api/kri/[id] — supprimer un KRI et ses mesures (gouvernance).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  if (!peutDefinirKri(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  await prisma.kri.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.kri.organizationId, ip: getClientIp(req),
    details: { scope: 'kri', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
}
