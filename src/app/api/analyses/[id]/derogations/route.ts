import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { canEditAnalyse } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { validateDerogationInput, statutInitial, calcDateFin, type DerogationWorkflow } from '@/lib/derogation'
import { auditLog, getClientIp } from '@/lib/logger'
import { NextResponse } from 'next/server'

// Accès à l'analyse (404 hors périmètre ou en corbeille) et rôle EFFECTIF dans son organisation : `withAccess`.

// GET /api/analyses/[id]/derogations — liste des dérogations de l'analyse.
export const GET = withAccess({ org: { analyse: 'id' } }, async (_req, { analyse }) => {
  const orgConfig = await getOrgConfig(analyse.organizationId)
  const derogations = await prisma.derogation.findMany({
    where: { analyseId: analyse.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    derogations,
    config: {
      dureeDefautJours: orgConfig.derogationDureeDefautJours,
      dureeMaxJours: orgConfig.derogationDureeMaxJours,
      alerteJours: orgConfig.derogationAlerteJours,
      active: orgConfig.derogationsActive,
      workflow: orgConfig.derogationWorkflow,
      doubleRegard: orgConfig.derogationDoubleRegard,
      petiteStructure: orgConfig.petiteStructure,
    },
  })
})

// POST /api/analyses/[id]/derogations — créer une demande de dérogation (porteur).
// Pas de `write` : l'ordre « module désactivé » (403) avant « édition » (403) est conservé, et la
// demande n'est pas soumise au gel (comportement inchangé).
export const POST = withAccess({ org: { analyse: 'id' }, rateLimit: { bucket: 'derogations' } }, async (req, { user, role, analyse }) => {
  const id = analyse.id
  const userId = user.id
  const userRole = user.role

  const orgConfig = await getOrgConfig(analyse.organizationId)
  if (!orgConfig.derogationsActive) {
    return NextResponse.json({ error: 'Les dérogations ne sont pas activées pour cette organisation' }, { status: 403 })
  }
  // RBAC sur le rôle EFFECTIF d'org (pas l'instance) — #130 (résolu par withAccess).
  if (!canEditAnalyse({ id: userId, role }, analyse)) {
    return NextResponse.json({ error: 'Accès refusé — seul le porteur peut demander une dérogation' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const input = {
    portee: String(body.portee ?? ''),
    referentiel: body.referentiel != null ? String(body.referentiel) : null,
    ref: body.ref != null ? String(body.ref) : null,
    risqueId: body.risqueId != null ? String(body.risqueId) : null,
    intitule: body.intitule != null ? String(body.intitule).slice(0, 255) : null,
    motif: body.motif != null ? String(body.motif).slice(0, 5000) : null,
    mesuresCompensatoires: body.mesuresCompensatoires != null ? String(body.mesuresCompensatoires).slice(0, 5000) : null,
  }
  const erreur = validateDerogationInput(input)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })

  // Si la portée cible un risque, vérifier qu'il appartient bien à l'analyse.
  if (input.portee === 'RISQUE') {
    const risque = await prisma.risque.findFirst({ where: { id: input.risqueId!, analyseId: id }, select: { id: true } })
    if (!risque) return NextResponse.json({ error: 'Risque introuvable dans cette analyse' }, { status: 400 })
  }

  // Niveau de workflow : AUTONOME (startup) → active immédiatement.
  const statut = statutInitial(orgConfig.derogationWorkflow as DerogationWorkflow)
  const now = new Date()
  // Durée demandée (date butoir) bornée à [1, délai max configuré] ; défaut = durée par défaut.
  const dureeDemandee = Number((body as { dureeJours?: unknown }).dureeJours)
  const duree = Number.isFinite(dureeDemandee) && dureeDemandee > 0
    ? Math.min(Math.round(dureeDemandee), orgConfig.derogationDureeMaxJours)
    : orgConfig.derogationDureeDefautJours
  const derogation = await prisma.derogation.create({
    data: {
      organizationId: analyse.organizationId ?? 'global',
      analyseId: id,
      portee: input.portee,
      referentiel: input.portee === 'CONTROLE' ? input.referentiel : null,
      ref: input.portee === 'CONTROLE' ? input.ref : null,
      risqueId: input.portee === 'RISQUE' ? input.risqueId : null,
      intitule: input.intitule!,
      motif: input.motif!,
      mesuresCompensatoires: input.mesuresCompensatoires!,
      demandeurId: userId,
      statut,
      ...(statut === 'ACTIVE' ? { dateDebut: now, dateFin: calcDateFin(now, duree) } : {}),
    },
  })
  await auditLog(statut === 'ACTIVE' ? 'DEROGATION_VALIDATED' : 'DEROGATION_REQUESTED', {
    userId, userRole, targetId: derogation.id, targetType: 'derogation', ip: getClientIp(req),
    details: { analyseId: id, portee: input.portee, intitule: input.intitule, workflow: orgConfig.derogationWorkflow },
  })
  return NextResponse.json(derogation, { status: 201 })
})
