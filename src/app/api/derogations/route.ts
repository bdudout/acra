import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import {
  validateDerogationInput, statutInitial, calcDateFin,
  canAvisRssiDerogation, canDoubleRegardDerogation, canValiderDerogation,
  type DerogationWorkflow, type DerogationStatut,
} from '@/lib/derogation'
import { auditLog, getClientIp } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/derogations — nombre de dérogations en attente de l'ACTION de
// l'utilisateur courant (file d'attente du valideur) : avis RSSI, double regard,
// validation métier — dans son périmètre d'organisations. Alimente le badge de
// la navbar. Réutilise les gardes RBAC pures (mêmes règles que les transitions).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const sessionUser = { id: userId, role: userRole }

  // Seuls les rôles susceptibles d'agir font la requête complète.
  if (userRole !== 'RSSI' && userRole !== 'DIRECTION_METIER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ pending: 0 })
  }

  const scope = await getAnalyseScope(userId, userRole)
  const rows = await prisma.derogation.findMany({
    where: {
      statut: { in: ['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER'] },
      ...(scope.scope.isSuperAdmin ? {} : { organizationId: { in: scope.scope.visibleOrgIds } }),
    },
    select: { statut: true, demandeurId: true, avisRssiPar: true },
  })
  const pending = rows.filter(r => {
    const rbac = { statut: r.statut as DerogationStatut, demandeurId: r.demandeurId, avisRssiPar: r.avisRssiPar }
    return canAvisRssiDerogation(sessionUser, rbac)
      || canDoubleRegardDerogation(sessionUser, rbac)
      || canValiderDerogation(sessionUser, rbac)
  }).length

  return NextResponse.json({ pending })
}

// POST /api/derogations — créer une dérogation AUTONOME (niveau organisation, sans
// analyse). Toujours rattachée à une mesure de référentiel (portée CONTROLE) : un
// risque appartient forcément à une analyse (donc pas de dérogation-risque autonome).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  // Rôles pouvant porter une dérogation : pas les lecteurs, ni la Direction métier
  // (qui valide) — c'est un « porteur » qui la demande.
  if (userRole === 'LECTEUR' || userRole === 'DIRECTION_METIER') {
    return NextResponse.json({ error: 'Rôle non autorisé à demander une dérogation' }, { status: 403 })
  }

  const scope = await getAnalyseScope(userId, userRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })

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
      ...(statut === 'ACTIVE' ? { dateDebut: now, dateFin: calcDateFin(now, orgConfig.derogationDureeDefautJours) } : {}),
    },
  })
  await auditLog(statut === 'ACTIVE' ? 'DEROGATION_VALIDATED' : 'DEROGATION_REQUESTED', {
    userId, userRole, targetId: derogation.id, targetType: 'derogation', ip: getClientIp(req),
    details: { organizationId: orgId, portee: 'CONTROLE', intitule: input.intitule, standalone: true, workflow: orgConfig.derogationWorkflow },
  })
  return NextResponse.json(derogation, { status: 201 })
}
