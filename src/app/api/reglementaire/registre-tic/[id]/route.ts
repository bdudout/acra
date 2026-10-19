import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getOrgConfig } from '@/lib/org-config.server'
import { cleanArrangementInput, validateArrangementInput } from '@/lib/registre-tic'
import { peutGererRegistreTic } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { resolveTierIdInput } from '@/lib/tier-registry.server'

export const dynamic = 'force-dynamic'

const access = { org: 'active', allow: peutGererRegistreTic, rateLimit: { bucket: 'registre-tic' } } as const

/** Module réglementaire actif et arrangement de l'organisation active (404 sinon). */
async function checkArrangement(orgId: string, id: string): Promise<NextResponse | null> {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.reglementaireActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })
  const row = await prisma.arrangementTic.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
  if (!row) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  return null
}

// PATCH /api/reglementaire/registre-tic/[id] — met à jour un arrangement (remplacement).
export const PATCH = withAccess(access, async (req, { user, role, orgId, params: { id } }) => {
  const refus = await checkArrangement(orgId, id)
  if (refus) return refus

  const body = await req.json().catch(() => ({}))
  const erreur = validateArrangementInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanArrangementInput(body)
  const tierInput = await resolveTierIdInput(body, orgId)
  if (!tierInput.ok) return NextResponse.json({ error: 'tier_invalide' }, { status: 400 })

  const updated = await prisma.arrangementTic.update({
    where: { id },
    data: { ...data, ...(tierInput.provided ? { tierId: tierInput.tierId } : {}), questionnaire: (data.questionnaire ?? []) as unknown as Prisma.InputJsonValue },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'registre-tic', action: 'update', id },
  })
  return NextResponse.json(updated)
})

// DELETE /api/reglementaire/registre-tic/[id] — supprime un arrangement.
export const DELETE = withAccess(access, async (req, { user, role, orgId, params: { id } }) => {
  const refus = await checkArrangement(orgId, id)
  if (refus) return refus

  await prisma.arrangementTic.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'registre-tic', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
