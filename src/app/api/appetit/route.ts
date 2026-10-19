import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { peutGouvernerAppetit } from '@/lib/permissions'
import { validateAppetitConfig, cleanAppetitConfig, SEUIL_MIN, SEUIL_MAX } from '@/lib/appetit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// L'appétit est une décision de GOUVERNANCE (`peutGouvernerAppetit`) : les autres rôles le consultent seulement.

// GET /api/appetit — configuration effective (héritée) + droit d'édition.
// Sans organisation active : { active: false } (pas de 400) — d'où `org: 'none'`.
export const GET = withAccess({ org: 'none' }, async (_req, { user }) => {
  const scope = await getAnalyseScope(user.id, user.role)
  const userRole = scope.role
  if (!scope.activeOrgId) return NextResponse.json({ active: false })
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ active: false })

  return NextResponse.json({
    active: true,
    appetit: cfg.appetitRisque,
    canEdit: peutGouvernerAppetit(userRole),
    seuilMin: SEUIL_MIN,
    seuilMax: SEUIL_MAX,
  })
})

// PUT /api/appetit — définit l'appétit de l'organisation ACTIVE (gouvernance).
// Module vérifié AVANT le rôle (ordre conservé) : le contrôle de rôle reste dans le handler.
export const PUT = withAccess({ org: 'active', rateLimit: { bucket: 'appetit' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutGouvernerAppetit(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const erreur = validateAppetitConfig(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const appetitRisque = cleanAppetitConfig(body)

  await upsertOrgConfig(orgId, { appetitRisque: appetitRisque as unknown as Prisma.InputJsonValue })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, targetId: orgId, targetType: 'organization', ip: getClientIp(req),
    details: { scope: 'appetit-risque' },
  })
  return NextResponse.json({ appetit: appetitRisque })
})
