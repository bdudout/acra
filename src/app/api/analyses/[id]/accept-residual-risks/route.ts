import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { NextRequest, NextResponse } from 'next/server'
import { canAcceptResidualRisks } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/analyses/[id]/accept-residual-risks
 * body: { action: 'ACCEPTER' | 'REFUSER' | 'REINITIALISER', commentaire?: string }
 *
 * Acceptation des RISQUES RÉSIDUELS (acceptation du risque), portée GLOBALE : une
 * décision pour l'ensemble des risques résiduels de l'analyse, DISTINCTE de la
 * validation de l'analyse (livrable). Réservé à la DIRECTION_METIER (et aux admins),
 * uniquement si `acceptationRisquesActive` est activé dans la configuration de l'org.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as import('@/lib/permissions').UserRole

  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, userRole, id),
    select: { id: true, nom: true, organizationId: true, deletedAt: true, risquesResiduelsStatut: true },
  })
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // La fonctionnalité doit être activée pour l'organisation de l'analyse.
  const orgConfig = await getOrgConfig(analyse.organizationId)
  if (!canAcceptResidualRisks({ id: userId, role: userRole }, orgConfig.acceptationRisquesActive)) {
    return NextResponse.json(
      { error: orgConfig.acceptationRisquesActive
          ? 'Réservé à la Direction métier'
          : 'L\'acceptation des risques résiduels n\'est pas activée pour cette organisation' },
      { status: 403 },
    )
  }

  const { action, commentaire } = await req.json().catch(() => ({})) as {
    action?: 'ACCEPTER' | 'REFUSER' | 'REINITIALISER'
    commentaire?: string
  }

  let statut: string
  if (action === 'ACCEPTER')            statut = 'ACCEPTES'
  else if (action === 'REFUSER')        statut = 'REFUSES'
  else if (action === 'REINITIALISER')  statut = 'EN_ATTENTE'
  else return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })

  // Un refus doit être motivé (traçabilité de la non-acceptation du risque).
  if (action === 'REFUSER' && !commentaire?.trim()) {
    return NextResponse.json({ error: 'Un commentaire est requis pour refuser les risques résiduels' }, { status: 400 })
  }

  const reset = statut === 'EN_ATTENTE'
  const updated = await prisma.analyse.update({
    where: { id },
    data: {
      risquesResiduelsStatut: statut,
      risquesResiduelsPar: reset ? null : userId,
      risquesResiduelsLe: reset ? null : new Date(),
      risquesResiduelsCommentaire: reset ? null : (commentaire?.trim() || null),
    },
    select: {
      id: true, risquesResiduelsStatut: true, risquesResiduelsPar: true,
      risquesResiduelsLe: true, risquesResiduelsCommentaire: true,
    },
  })

  await auditLog('RESIDUAL_RISKS_DECISION', {
    userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req),
    details: { nom: analyse.nom, statut, commentaire: commentaire?.trim() || undefined },
  })
  return NextResponse.json(updated)
}
