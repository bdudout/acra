import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import {
  validateIncidentInput, cleanIncidentInput, transitionAutorisee,
  qualificationComplete, type IncidentStatut,
} from '@/lib/incident'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// La QUALIFICATION relève de la 2ᵉ ligne (risk manager / RSSI / admin) :
// taxonomie, coût réel, rattachement au registre.
function peutQualifier(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RISK_MANAGER' || role === 'RSSI'
}

async function loadInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const incident = await prisma.incident.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, statut: true, declarantId: true, taxonomieCode: true },
  })
  if (!incident) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const orgConfig = await getOrgConfig(incident.organizationId)
  if (!orgConfig.incidentsActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, incident }
}

// PATCH /api/incidents/[id] — qualifier, clôturer, rejeter ou corriger.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  const { userId, userRole, incident } = c

  const body = await req.json().catch(() => ({}))
  const erreur = validateIncidentInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanIncidentInput(body)

  const depuis = incident.statut as IncidentStatut
  const vers = data.statut
  if (!transitionAutorisee(depuis, vers)) {
    return NextResponse.json({ error: 'transition_interdite' }, { status: 400 })
  }

  // Écriture : le déclarant peut corriger sa déclaration tant qu'elle est DECLARE ;
  // tout changement d'état ou de qualification exige la 2ᵉ ligne.
  const changeEtat = vers !== depuis
  const estDeclarant = incident.declarantId === userId
  if (changeEtat || !(estDeclarant && depuis === 'DECLARE')) {
    if (!peutQualifier(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  }

  // Passer en QUALIFIE suppose la taxonomie renseignée (objet de la qualification).
  if (vers === 'QUALIFIE' && !qualificationComplete({ taxonomieCode: data.taxonomieCode })) {
    return NextResponse.json({ error: 'taxonomie_requise' }, { status: 400 })
  }

  const orgId = incident.organizationId
  if (data.processusId) {
    const p = await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: orgId }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: orgId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  // PATCH = mise à jour PARTIELLE : on n'écrit que les champs réellement présents
  // dans le corps. Sans ce filtre, un PATCH de qualification écraserait à null les
  // dates et la maille posées à la déclaration.
  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[])
      .filter(k => k in body)
      .map(k => [k, data[k]]),
  ) as Partial<typeof data>

  const now = new Date()
  const updated = await prisma.incident.update({
    where: { id },
    data: {
      ...partiel,
      // Horodatages posés à la transition, jamais réécrits ensuite.
      ...(vers === 'QUALIFIE' && depuis !== 'QUALIFIE' ? { qualifiePar: userId, qualifieLe: now } : {}),
      ...(vers === 'CLOTURE' && depuis !== 'CLOTURE' ? { clotureLe: now } : {}),
      ...(typeof body.clotureCommentaire === 'string' ? { clotureCommentaire: body.clotureCommentaire.trim() || null } : {}),
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'incident', action: changeEtat ? `transition:${depuis}->${vers}` : 'update', id },
  })
  return NextResponse.json(updated)
}

// DELETE /api/incidents/[id] — réservé à la 2ᵉ ligne (un incident se rejette
// plutôt qu'il ne se supprime ; la suppression reste possible pour les doublons).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  const { userId, userRole, incident } = c
  if (!peutQualifier(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  await prisma.incident.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: incident.organizationId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
}
