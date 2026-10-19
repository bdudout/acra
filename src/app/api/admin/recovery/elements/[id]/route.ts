// ─── Corbeille des éléments supprimés (incidents) : restauration / purge (ADMIN) ─
// PATCH  : recrée l'incident à l'identique (même identifiant, liens encore valides) et vide l'entrée de corbeille.
// DELETE : purge définitive de l'instantané. Périmètre : organisations administrées (SUPER_ADMIN : toutes).
// Logique pure : lib/corbeille.
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getAdminOrgIds } from '@/lib/org-context.server'
import { restaurationIncident, type InstantaneIncident } from '@/lib/corbeille'
import { auditLog, getClientIp } from '@/lib/logger'
import { withAccess } from '@/lib/with-access.server'

// Corbeille : réservée aux administrateurs (rôle d'instance, `canAdmin`).
const ADMIN = { org: 'none', allow: isAdminRole, rateLimit: { bucket: 'admin-recovery-elements' } } as const

/** Élément de la corbeille dans le périmètre administré (404 sinon). */
async function elementDansPerimetre(userId: string, role: UserRole, id: string) {
  const { all, ids } = await getAdminOrgIds(userId, role)
  return prisma.elementSupprime.findFirst({ where: { id, ...(all ? {} : { organizationId: { in: ids } }) } })
}
const introuvable = () => NextResponse.json({ error: 'Élément introuvable dans la corbeille' }, { status: 404 })

export const PATCH = withAccess(ADMIN, async (req, { user, params }) => {
  const element = await elementDansPerimetre(user.id, user.role, params.id)
  if (!element) return introuvable()
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
    userId: user.id, userRole: user.role, organizationId: element.organizationId, targetId: element.objetId, targetType: 'incident', ip: getClientIp(req),
    details: { intitule: element.intitule, corbeilleId: element.id },
  })
  return NextResponse.json({ ok: true })
})

export const DELETE = withAccess(ADMIN, async (req, { user, params }) => {
  const element = await elementDansPerimetre(user.id, user.role, params.id)
  if (!element) return introuvable()
  await prisma.elementSupprime.delete({ where: { id: element.id } })
  await auditLog('INCIDENT_PURGED', {
    userId: user.id, userRole: user.role, organizationId: element.organizationId, targetId: element.objetId, targetType: 'incident', ip: getClientIp(req),
    details: { intitule: element.intitule, corbeilleId: element.id },
  })
  return NextResponse.json({ ok: true })
})
