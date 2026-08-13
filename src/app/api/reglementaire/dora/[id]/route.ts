import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { cleanDoraCriteres, classifierIncident, estEvalueDora } from '@/lib/dora'
import { peutEvaluerDora } from '../route'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/reglementaire/dora/[id] — évaluer/mettre à jour les critères DORA
// d'un incident (gouvernance). Retourne la classification recalculée.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const { id } = await params
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (!peutEvaluerDora(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const orgIds = scope.scope.visibleOrgIds
  const spansAll = scope.scope.isSuperAdmin && orgIds.length === 0
  const incident = await prisma.incident.findFirst({
    where: { id, ...(spansAll ? {} : { organizationId: { in: orgIds } }) },
    select: { id: true, organizationId: true },
  })
  if (!incident) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const cfg = await getOrgConfig(incident.organizationId)
  if (!cfg.reglementaireActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const doraCriteres = cleanDoraCriteres(body)

  await prisma.incident.update({
    where: { id },
    data: { doraCriteres: doraCriteres as unknown as Prisma.InputJsonValue },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: incident.organizationId, ip: getClientIp(req),
    details: { scope: 'reglementaire-dora', action: 'assess', id },
  })
  const evalue = estEvalueDora(doraCriteres)
  return NextResponse.json({ criteres: doraCriteres, evalue, classe: evalue ? classifierIncident(doraCriteres).classe : null })
}
