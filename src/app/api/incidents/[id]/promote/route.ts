import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { estPromouvable, promoteToRisk } from '@/lib/incident'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/incidents/[id]/promote — crée un risque au REGISTRE depuis un
 * incident orphelin (aucun risque rattaché) et lie l'incident au risque créé.
 * Réservé à la 2ᵉ ligne. Exige les DEUX modules actifs (incidents + registre).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  if (!(isAdminRole(userRole) || userRole === 'RISK_MANAGER' || userRole === 'RSSI')) {
    return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  }

  const { id } = await params
  const scope = await getAnalyseScope(userId, userRole)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const incident = await prisma.incident.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: {
      id: true, organizationId: true, intitule: true, description: true,
      taxonomieCode: true, processusId: true, entite: true, impactEstime: true,
      montantBrut: true, recuperations: true, riskItemId: true,
    },
  })
  if (!incident) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const cfg = await getOrgConfig(incident.organizationId)
  if (!cfg.incidentsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  // Sans le registre, il n'y a pas d'endroit où créer le risque.
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'registre_inactif' }, { status: 403 })

  if (!estPromouvable(incident)) return NextResponse.json({ error: 'deja_rattache' }, { status: 400 })

  const num = (v: unknown): number | null => (v == null ? null : Number(v as unknown as string))
  const data = promoteToRisk({
    ...incident,
    montantBrut: num(incident.montantBrut),
    recuperations: num(incident.recuperations),
  })

  // Création du risque puis rattachement de l'incident, en une transaction :
  // un risque orphelin (sans son incident lié) serait trompeur pour la LDC.
  const risk = await prisma.$transaction(async tx => {
    const created = await tx.riskItem.create({
      data: { ...data, organizationId: incident.organizationId },
    })
    await tx.incident.update({ where: { id }, data: { riskItemId: created.id } })
    return created
  })

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: incident.organizationId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'promote', incidentId: id, riskItemId: risk.id },
  })
  return NextResponse.json({ ok: true, riskItem: risk }, { status: 201 })
}
