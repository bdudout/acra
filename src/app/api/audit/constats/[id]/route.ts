import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutEcrireAudit } from '@/lib/permissions'
import { validateConstatInput, cleanConstatInput } from '@/lib/audit'
import { sanitizeChampsConfig, fusionnerChamps, avecChampsVisibles } from '@/lib/champs-perso'
import type { Prisma } from '@prisma/client'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Constat cherché dans le périmètre visible (multi-organisation), sans exiger d'organisation
// active : `org: 'none'` + getAnalyseScope ici ; 404 avant le contrôle de rôle (ordre conservé).
const ACCESS = { org: 'none', rateLimit: { bucket: 'audit-constats' } } as const

async function loadInScope(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const constat = await prisma.auditConstat.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, champs: true },
  })
  if (!constat) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const cfg = await getOrgConfig(constat.organizationId)
  if (!cfg.auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, constat, champsPersonnalises: cfg.champsPersonnalises }
}

// PATCH /api/audit/constats/[id] — modifier un constat / faire évoluer son suivi.
export const PATCH = withAccess(ACCESS, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutEcrireAudit(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateConstatInput(body, { partial: true })
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanConstatInput(body)

  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: c.constat.organizationId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  // Mise à jour PARTIELLE : on n'écrit que les champs présents dans le corps.
  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[]).filter(k => k in body).map(k => [k, data[k]]),
  ) as Partial<typeof data>

  const defsChamps = sanitizeChampsConfig(c.champsPersonnalises).constat ?? []
  const champsMaj = 'champs' in body ? { champs: fusionnerChamps(defsChamps, c.constat.champs, body.champs, c.userRole) as unknown as Prisma.InputJsonValue } : {}
  const updated = await prisma.auditConstat.update({ where: { id }, data: { ...partiel, ...champsMaj } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.constat.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-constat', action: 'update', id },
  })
  return NextResponse.json(avecChampsVisibles(updated, defsChamps, c.userRole))
})

// DELETE /api/audit/constats/[id] — supprimer un constat (auditeur / admin).
export const DELETE = withAccess(ACCESS, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutEcrireAudit(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  await prisma.auditConstat.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.constat.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-constat', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
