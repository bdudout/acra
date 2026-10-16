import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutGererReferentiels } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { validateReferentielInput, cleanReferentielInput } from '@/lib/referentiel'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
// Écriture : organisation active, rôle effectif `peutGererReferentiels`, rate limit.
const ECRITURE = { org: 'active', allow: peutGererReferentiels, rateLimit: { bucket: 'referentiels' } } as const

// Contrôles métier : module conformité actif, référentiel de l'organisation (404 sinon).
async function guard(orgId: string, id: string): Promise<NextResponse | null> {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })
  const row = await prisma.referentiel.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
  if (!row) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  return null
}

// GET /api/referentiels/[id] — détail d'un référentiel custom (avec exigences).
export const GET = withAccess({ org: 'active' }, async (_req, { orgId, params: { id } }) => {
  const row = await prisma.referentiel.findFirst({ where: { id, organizationId: orgId } })
  if (!row) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  return NextResponse.json(row)
})

// PATCH /api/referentiels/[id] — met à jour un référentiel custom.
export const PATCH = withAccess(ECRITURE, async (req, { user, role, orgId, params: { id } }) => {
  const refus = await guard(orgId, id)
  if (refus) return refus
  const g = { userId: user.id, userRole: role, orgId }

  const body = await req.json().catch(() => ({}))
  const erreur = validateReferentielInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanReferentielInput(body)

  // Code unique par organisation (hors la ligne courante).
  const clash = await prisma.referentiel.findFirst({ where: { organizationId: g.orgId, code: data.code, id: { not: id } }, select: { id: true } })
  if (clash) return NextResponse.json({ error: 'code_existant' }, { status: 409 })

  const updated = await prisma.referentiel.update({
    where: { id },
    data: {
      code: data.code, nom: data.nom, type: data.type, domaine: data.domaine, version: data.version, description: data.description,
      exigences: data.exigences as unknown as Prisma.InputJsonValue,
      missions: data.missions as unknown as Prisma.InputJsonValue,
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: g.userId, userRole: g.userRole, organizationId: g.orgId, ip: getClientIp(req),
    details: { scope: 'referentiel', action: 'update', id },
  })
  return NextResponse.json(updated)
})

// DELETE /api/referentiels/[id]
export const DELETE = withAccess(ECRITURE, async (req, { user, role, orgId, params: { id } }) => {
  const refus = await guard(orgId, id)
  if (refus) return refus
  const g = { userId: user.id, userRole: role, orgId }
  await prisma.referentiel.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: g.userId, userRole: g.userRole, organizationId: g.orgId, ip: getClientIp(req),
    details: { scope: 'referentiel', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
