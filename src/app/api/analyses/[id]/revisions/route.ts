import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canViewAnalyse, canEditAnalyse } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseGelee } from '@/lib/gel-analyse'
import { auditLog, getClientIp } from '@/lib/logger'
import { normalizeCycle, nextVersion, formatVersion } from '@/lib/version-analyse'

// Accès à l'analyse (404 hors périmètre ou en corbeille) : `withAccess` (mode analyse, sans `write` :
// ouvrir une révision doit rester possible sur une analyse gelée — c'est ce qui la rouvre).
const lireVersion = (id: string) => prisma.analyse.findFirst({ where: { id }, select: { versionMajeure: true, versionMineure: true } })

// GET /api/analyses/:id/revisions — historique des révisions (label EBIOS RM §3.4)
export const GET = withAccess({ org: { analyse: 'id' } }, async (_req, { user, analyse }) => {
  // Lecture évaluée sur le rôle de SESSION (instance), comme avant la migration.
  if (!canViewAnalyse({ id: user.id, role: user.role }, analyse)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  const id = analyse.id
  const v = await lireVersion(id)
  if (!v) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  const revisions = await prisma.revisionAnalyse.findMany({
    where: { analyseId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    version: formatVersion(v.versionMajeure, v.versionMineure),
    revisions,
  })
})

// POST /api/analyses/:id/revisions — enregistre une nouvelle révision x.y
export const POST = withAccess({ org: { analyse: 'id' }, rateLimit: { bucket: 'revisions' } }, async (req, { user, role: effRole, analyse }) => {
  const id = analyse.id
  const userId = user.id
  // F01 (CWE-863) : rôle EFFECTIF dans l'organisation de l'analyse, pas le rôle d'instance (résolu par withAccess).
  if (!canEditAnalyse({ id: userId, role: effRole }, analyse)) {
    return NextResponse.json({ error: 'Accès refusé — édition non autorisée' }, { status: 403 })
  }
  const v = await lireVersion(id)
  if (!v) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const cycle = normalizeCycle(body.cycle)
  const note = body.note != null ? String(body.note).slice(0, 2000) : null
  // Ateliers concernés : entiers 1..5, dédoublonnés et triés.
  const rawAteliers: unknown[] = Array.isArray(body.ateliers) ? body.ateliers : []
  const ateliers: number[] = Array.from(new Set(
    rawAteliers
      .map((n) => Math.floor(Number(n)))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
  )).sort((a, b) => a - b)

  const { maj, min } = nextVersion(v.versionMajeure, v.versionMineure, cycle)
  const version = formatVersion(maj, min)

  // Réouverture d'une analyse gelée : une nouvelle version invalide l'acceptation
  // des risques résiduels et rend l'analyse de nouveau modifiable → statut « en attente ».
  const orgConfig = await getOrgConfig(analyse.organizationId).catch(() => null)
  const rouvreGel = analyseGelee(analyse.risquesResiduelsStatut, orgConfig?.gelApresAcceptationActive ?? false)
  const resetAcceptation = rouvreGel
    ? { risquesResiduelsStatut: 'EN_ATTENTE', risquesResiduelsPar: null, risquesResiduelsLe: null, risquesResiduelsCommentaire: null }
    : {}

  const [, revision] = await prisma.$transaction([
    prisma.analyse.update({
      where: { id },
      data: { versionMajeure: maj, versionMineure: min, updatedAt: new Date(), ...resetAcceptation },
    }),
    prisma.revisionAnalyse.create({
      data: { analyseId: id, version, cycle, note, ateliers, createdById: userId },
    }),
  ])

  await auditLog('ANALYSE_REVISED', {
    userId,
    targetId: id,
    targetType: 'analyse',
    ip: getClientIp(req),
    details: { version, cycle, ateliers },
  })

  return NextResponse.json({ version, revision })
})
