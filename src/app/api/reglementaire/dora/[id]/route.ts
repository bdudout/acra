import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { cleanDoraCriteres, classifierIncident, estEvalueDora } from '@/lib/dora'
import { peutEvaluerDora } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// PATCH /api/reglementaire/dora/[id] — évaluer/mettre à jour les critères DORA
// d'un incident (gouvernance). Retourne la classification recalculée.
// `org: 'none'` : l'incident est cherché dans tout le périmètre visible (SUPER_ADMIN non focalisé inclus).
export const PATCH = withAccess({ org: 'none', rateLimit: { bucket: 'reglementaire-dora' } }, async (req, { user, params: { id } }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.visibleOrgIds
  const spansAll = scope.scope.isSuperAdmin && orgIds.length === 0
  const incident = await prisma.incident.findFirst({
    where: { id, ...(spansAll ? {} : { organizationId: { in: orgIds } }) },
    select: { id: true, organizationId: true },
  })
  if (!incident) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const userRole = await roleSurRessource(userId, user.role, incident.organizationId)
  if (!peutEvaluerDora(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
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
})
