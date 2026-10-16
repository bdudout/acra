/**
 * Reprendre la conformité d'une ANALYSE dans le socle de l'organisation.
 *  GET  ?referentiel=X — analyses de l'org ayant une conformité pour ce référentiel.
 *  POST { referentiel, analyseId } — copie les entrées de l'analyse dans le suivi org.
 * Réservé ADMIN / RSSI / Risk Manager, quand la conformité est portée au niveau org.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutGererConformite } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { usesConformiteEntity } from '@/lib/conformite-config'
import { sanitizeConformite } from '@/lib/conformite'

export const dynamic = 'force-dynamic'
/** Gestion de la conformité : gouvernance, dont CONFORMITE et DPO (lib/permissions). */
const GESTION = { org: { param: 'orgId' }, allow: peutGererConformite } as const

/** Conformité active et portée au niveau organisation ; sinon la réponse d'erreur. */
async function conformiteOrgIndisponible(orgId: string): Promise<NextResponse | null> {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'Conformité désactivée' }, { status: 403 })
  if (!usesConformiteEntity(cfg.conformiteNiveau)) return NextResponse.json({ error: 'Conformité non portée au niveau organisation' }, { status: 409 })
  return null
}

// GET /api/organizations/[orgId]/conformite/import?referentiel= — liste les analyses de l'org portant ce référentiel et dont la conformité (socle) est reprenable.
export const GET = withAccess(GESTION, async (req, { orgId }) => {
  const indispo = await conformiteOrgIndisponible(orgId)
  if (indispo) return indispo
  const referentiel = new URL(req.url).searchParams.get('referentiel') ?? ''
  if (!referentiel) return NextResponse.json({ analyses: [] })

  const rows = await prisma.analyse.findMany({
    where: { organizationId: orgId, deletedAt: null, referentielMesures: referentiel },
    select: { id: true, nom: true, updatedAt: true, cadrage: { select: { socleSecurite: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  const analyses = rows
    .map(a => ({ id: a.id, nom: a.nom, count: sanitizeConformite(a.cadrage?.socleSecurite).length }))
    .filter(a => a.count > 0)
  return NextResponse.json({ analyses })
})

// POST /api/organizations/[orgId]/conformite/import — reprend la conformité (socle de sécurité) d'une analyse dans le suivi conformité de l'org (référentiel + entité).
export const POST = withAccess({ ...GESTION, rateLimit: { bucket: 'org-conformite' } }, async (req, { orgId }) => {
  const indispo = await conformiteOrgIndisponible(orgId)
  if (indispo) return indispo

  const body = await req.json().catch(() => ({}))
  const referentiel = typeof body?.referentiel === 'string' ? body.referentiel.trim() : ''
  const analyseId = typeof body?.analyseId === 'string' ? body.analyseId : ''
  const entite = typeof body?.entite === 'string' ? body.entite.trim().slice(0, 80) : ''
  if (!referentiel || referentiel === 'CUSTOM' || !analyseId) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

  const analyse = await prisma.analyse.findFirst({
    where: { id: analyseId, organizationId: orgId, deletedAt: null },
    select: { referentielMesures: true, cadrage: { select: { socleSecurite: true } } },
  })
  if (!analyse) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  const entries = sanitizeConformite(analyse.cadrage?.socleSecurite)
  if (entries.length === 0) return NextResponse.json({ error: 'Aucune conformité à reprendre' }, { status: 400 })

  await prisma.conformite.upsert({
    where: { organizationId_referentiel_entite: { organizationId: orgId, referentiel, entite } },
    create: { organizationId: orgId, referentiel, entite, nom: entite || null, entries: entries as unknown as Prisma.InputJsonValue },
    update: { entries: entries as unknown as Prisma.InputJsonValue },
  })
  return NextResponse.json({ ok: true, imported: entries.length })
})
