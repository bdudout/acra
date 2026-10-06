// ─── Corbeille des éléments supprimés (incidents) : restauration / purge (ADMIN) ─
// PATCH  : recrée l'incident à l'identique (même identifiant, liens encore valides) et vide l'entrée de corbeille.
// DELETE : purge définitive de l'instantané. Périmètre : organisations administrées (SUPER_ADMIN : toutes).
// Logique pure : lib/corbeille.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdmin, type UserRole } from '@/lib/permissions'
import { getAdminOrgIds } from '@/lib/org-context.server'
import { restaurationIncident, type InstantaneIncident } from '@/lib/corbeille'
import { auditLog, getClientIp } from '@/lib/logger'

type Params = { params: Promise<{ id: string }> }

async function contexte(params: Params['params']) {
  const u = (await getServerSession(authOptions))?.user as { id?: string; role?: string } | undefined
  if (!u?.id) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const role = (u.role ?? 'ANALYSTE') as UserRole
  if (!canAdmin({ id: u.id, role })) return { erreur: NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 }) }
  const { all, ids } = await getAdminOrgIds(u.id, role)
  const { id } = await params
  const element = await prisma.elementSupprime.findFirst({ where: { id, ...(all ? {} : { organizationId: { in: ids } }) } })
  if (!element) return { erreur: NextResponse.json({ error: 'Élément introuvable dans la corbeille' }, { status: 404 }) }
  return { userId: u.id, role, element }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const c = await contexte(params)
  if ('erreur' in c) return c.erreur
  const { element } = c
  if (element.type !== 'INCIDENT') return NextResponse.json({ error: 'type_inconnu' }, { status: 400 })
  const instantane = element.donnees as unknown as InstantaneIncident
  const resultat = await prisma.$transaction(async tx => {
    if (await tx.incident.findFirst({ where: { id: element.objetId }, select: { id: true } })) return 'existe' as const
    const pid = instantane.incident?.processusId
    const rids = [...new Set([...(instantane.risqueIds ?? []), ...(instantane.incident?.riskItemId ? [String(instantane.incident.riskItemId)] : [])])]
    const [processus, risques] = await Promise.all([
      pid ? tx.processus.findMany({ where: { id: String(pid), organizationId: element.organizationId }, select: { id: true } }) : [],
      rids.length ? tx.riskItem.findMany({ where: { id: { in: rids }, organizationId: element.organizationId }, select: { id: true } }) : [],
    ])
    const r = restaurationIncident(instantane, { processusIds: processus.map(p => p.id), riskItemIds: risques.map(x => x.id) })
    // L'incident revient dans SON organisation, quel que soit le contenu de l'instantané.
    await tx.incident.create({ data: { ...r.data, organizationId: element.organizationId } as unknown as Prisma.IncidentUncheckedCreateInput })
    if (r.risqueIds.length) await tx.incidentRisque.createMany({ data: r.risqueIds.map(riskItemId => ({ incidentId: element.objetId, riskItemId })), skipDuplicates: true })
    await tx.elementSupprime.delete({ where: { id: element.id } })
    return 'ok' as const
  })
  if (resultat === 'existe') return NextResponse.json({ error: 'deja_restaure' }, { status: 409 })
  await auditLog('INCIDENT_RESTORED', {
    userId: c.userId, userRole: c.role, organizationId: element.organizationId, targetId: element.objetId, targetType: 'incident', ip: getClientIp(req),
    details: { intitule: element.intitule, corbeilleId: element.id },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const c = await contexte(params)
  if ('erreur' in c) return c.erreur
  await prisma.elementSupprime.delete({ where: { id: c.element.id } })
  await auditLog('INCIDENT_PURGED', {
    userId: c.userId, userRole: c.role, organizationId: c.element.organizationId, targetId: c.element.objetId, targetType: 'incident', ip: getClientIp(req),
    details: { intitule: c.element.intitule, corbeilleId: c.element.id },
  })
  return NextResponse.json({ ok: true })
}
