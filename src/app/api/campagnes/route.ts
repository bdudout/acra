import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { validateCampagneInput, cleanCampagneInput, avancementCampagne } from '@/lib/campagne'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Piloter une campagne relève de la 2ᵉ ligne (risk manager / RSSI / admin). */
import { peutPiloter } from '@/lib/permissions'
import { campagnesRcsaActives } from '@/lib/org-config'

// GET /api/campagnes — campagnes de l'organisation active + avancement.
// Sans organisation active : { campagnes: [], active: false } (pas de 400) — d'où `org: 'none'`.
export const GET = withAccess({ org: 'none' }, async (_req, { user }) => {
  const orgId = (await getAnalyseScope(user.id, user.role)).activeOrgId
  if (!orgId) return NextResponse.json({ campagnes: [], active: false })
  // Les campagnes portent sur le registre : elles suivent le module registre.
  const cfg = await getOrgConfig(orgId)
  if (!campagnesRcsaActives(cfg)) return NextResponse.json({ campagnes: [], active: false })

  const rows = await prisma.campagne.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    include: { evaluations: { select: { statut: true } } },
  })
  const campagnes = rows.map(({ evaluations, ...c }) => ({
    ...c,
    avancement: avancementCampagne(evaluations),
  }))
  return NextResponse.json({ campagnes, active: true })
})

// POST /api/campagnes — créer une campagne (BROUILLON, 2ᵉ ligne).
// Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863 ; le contrôle
// de rôle dépend de `secondeLigneActive` (config d'org) : il reste dans le handler.
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'campagnes' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!peutPiloter(userRole, { secondeLigneActive: cfg.secondeLigneActive })) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!campagnesRcsaActives(cfg)) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateCampagneInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanCampagneInput(body)

  const campagne = await prisma.campagne.create({ data: { ...data, organizationId: orgId, statut: 'BROUILLON' } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'campagne', action: 'create', id: campagne.id },
  })
  return NextResponse.json(campagne, { status: 201 })
})
