import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import { peutLireRapports, peutEcrireRapports } from '@/lib/rapport-acces'
import { rapportsDisponibles, validerPeriode, RAPPORT_CODES, type RapportCode } from '@/lib/rapport-model'
import { genererContenuRapport } from '@/lib/rapports.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/rapports — éditions de l'organisation active (sans le contenu), rapports disponibles.
export const GET = withAccess({ org: 'active', allow: peutLireRapports }, async (_req, { role, orgId }) => {
  const c = { role, orgId }
  const cfg = await getOrgConfig(c.orgId)
  if (!cfg.rapportsGrcActive) return NextResponse.json({ error: 'module_inactif' }, { status: 404 })
  const editions = await prisma.rapportEdition.findMany({
    where: { organizationId: c.orgId }, orderBy: { createdAt: 'desc' }, take: 200,
    select: { id: true, code: true, statut: true, periodeDebut: true, periodeFin: true, langue: true, createdAt: true, createdById: true, valideLe: true, diffuseLe: true },
  })
  return NextResponse.json({ editions, disponibles: rapportsDisponibles(cfg), canWrite: peutEcrireRapports(c.role), livrableDora: !!cfg.reglementaireActive })
})

// POST /api/rapports — génère une édition (BROUILLON) : contenu calculé et figé pour la période.
export const POST = withAccess({ org: 'active', allow: peutEcrireRapports, rateLimit: { bucket: 'rapports' } }, async (req, { user, role, orgId }) => {
  const c = { userId: user.id, role, orgId }

  const body = await req.json().catch(() => ({}))
  const cfg = await getOrgConfig(c.orgId)
  const code = (RAPPORT_CODES as readonly string[]).includes(body.code) ? (body.code as RapportCode) : null
  if (!code || !rapportsDisponibles(cfg).some(r => r.code === code)) return NextResponse.json({ error: 'rapport_indisponible' }, { status: 400 })
  const erreur = validerPeriode(body.periode ?? {})
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const langue = ['fr', 'en', 'de', 'es', 'it'].includes(body.langue) ? (body.langue as string) : 'fr'
  const periode = { debut: body.periode.debut as string, fin: body.periode.fin as string }

  const now = new Date()
  const contenu = await genererContenuRapport(code, c.orgId, cfg, periode, langue, now)
  const edition = await prisma.rapportEdition.create({
    data: {
      organizationId: c.orgId, code, langue, statut: 'BROUILLON', createdById: c.userId,
      periodeDebut: new Date(`${periode.debut}T00:00:00Z`), periodeFin: new Date(`${periode.fin}T00:00:00Z`),
      contenu: contenu as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, code: true, statut: true },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req),
    details: { scope: 'rapport', action: 'generer', id: edition.id, code, periode },
  })
  return NextResponse.json(edition, { status: 201 })
})
