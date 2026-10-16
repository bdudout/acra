import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, optionsStructure } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import {
  validateDerogationInput, statutInitial, calcDateFin,
  canAvisRssiDerogation, canDoubleRegardDerogation, canValiderDerogation,
  type DerogationWorkflow, type DerogationStatut,
} from '@/lib/derogation'
import { auditLog, getClientIp } from '@/lib/logger'
import { NextResponse } from 'next/server'

// GET /api/derogations — nombre de dérogations en attente de l'ACTION de
// l'utilisateur courant (file d'attente du valideur) : avis RSSI, double regard,
// validation métier — dans son périmètre d'organisations. Alimente le badge de
// la navbar. Réutilise les gardes RBAC pures (mêmes règles que les transitions).
// org: 'none' : périmètre multi-organisation (scope.scope), sans organisation active requise.
export const GET = withAccess({ org: 'none' }, async (_req, { user }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  const sessionUser = { id: userId, role: userRole }

  // Seuls les rôles susceptibles d'agir font la requête complète.
  // (RISK_MANAGER : peut agir en petite structure, où il exerce aussi le rôle RSSI.)
  if (userRole !== 'RSSI' && userRole !== 'RISK_MANAGER' && userRole !== 'DIRECTION_METIER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ pending: 0 })
  }
  const rows = await prisma.derogation.findMany({
    where: {
      statut: { in: ['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER'] },
      ...(scope.scope.isSuperAdmin ? {} : { organizationId: { in: scope.scope.visibleOrgIds } }),
    },
    select: { statut: true, demandeurId: true, avisRssiPar: true, organizationId: true },
  })
  // Cumul des rôles résolu par organisation (petite structure).
  const structures = new Map<string, { petiteStructure: boolean }>()
  for (const id of new Set(rows.map(r => r.organizationId))) structures.set(id, await optionsStructure(id))
  const pending = rows.filter(r => {
    const rbac = { statut: r.statut as DerogationStatut, demandeurId: r.demandeurId, avisRssiPar: r.avisRssiPar }
    const structure = structures.get(r.organizationId)
    return canAvisRssiDerogation(sessionUser, rbac, structure)
      || canDoubleRegardDerogation(sessionUser, rbac, structure)
      || canValiderDerogation(sessionUser, rbac)
  }).length

  return NextResponse.json({ pending })
})

// POST /api/derogations — créer une dérogation AUTONOME (niveau organisation, sans
// analyse). Toujours rattachée à une mesure de référentiel (portée CONTROLE) : un
// risque appartient forcément à une analyse (donc pas de dérogation-risque autonome).
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'derogations' } }, async (req, { user, role, orgId }) => {
  const userId = user.id
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = role

  // Rôles pouvant porter une dérogation : pas les lecteurs, ni la Direction métier
  // (qui valide) — c'est un « porteur » qui la demande.
  if (userRole === 'LECTEUR' || userRole === 'DIRECTION_METIER') {
    return NextResponse.json({ error: 'Rôle non autorisé à demander une dérogation' }, { status: 403 })
  }

  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.derogationsActive) {
    return NextResponse.json({ error: 'Les dérogations ne sont pas activées pour cette organisation' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const input = {
    portee: String(body.portee ?? 'CONTROLE'),
    referentiel: body.referentiel != null ? String(body.referentiel) : null,
    ref: body.ref != null ? String(body.ref) : null,
    risqueId: null, // une dérogation autonome ne porte jamais sur un risque
    intitule: body.intitule != null ? String(body.intitule).slice(0, 255) : null,
    motif: body.motif != null ? String(body.motif).slice(0, 5000) : null,
    mesuresCompensatoires: body.mesuresCompensatoires != null ? String(body.mesuresCompensatoires).slice(0, 5000) : null,
  }
  // Autonome ⇒ portée CONTROLE obligatoire (référentiel + contrôle).
  if (input.portee !== 'CONTROLE') return NextResponse.json({ error: 'portee_invalide' }, { status: 400 })
  const erreur = validateDerogationInput(input)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })

  // Niveau de workflow : AUTONOME (startup) → active immédiatement.
  const statut = statutInitial(orgConfig.derogationWorkflow as DerogationWorkflow)
  const now = new Date()
  // Durée demandée (date butoir) — bornée à [1, délai max configuré] ; défaut = durée par défaut.
  const dureeDemandee = Number(body.dureeJours)
  const duree = Number.isFinite(dureeDemandee) && dureeDemandee > 0
    ? Math.min(Math.round(dureeDemandee), orgConfig.derogationDureeMaxJours)
    : orgConfig.derogationDureeDefautJours
  const derogation = await prisma.derogation.create({
    data: {
      organizationId: orgId,
      analyseId: null,
      portee: 'CONTROLE',
      referentiel: input.referentiel,
      ref: input.ref,
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
    details: { organizationId: orgId, portee: 'CONTROLE', intitule: input.intitule, standalone: true, workflow: orgConfig.derogationWorkflow },
  })
  return NextResponse.json(derogation, { status: 201 })
})
