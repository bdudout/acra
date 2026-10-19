import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { NextResponse } from 'next/server'
import { canAcceptResidualRisks } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { motifBlocageAcceptation, resumeRisquesResiduels } from '@/lib/acceptation-residuels'

/**
 * POST /api/analyses/[id]/accept-residual-risks
 * body: { action: 'ACCEPTER' | 'REFUSER' | 'REINITIALISER', commentaire?: string }
 *
 * Acceptation des RISQUES RÉSIDUELS (acceptation du risque), portée GLOBALE : une
 * décision pour l'ensemble des risques résiduels de l'analyse, DISTINCTE de la
 * validation de l'analyse (livrable). Réservé à la DIRECTION_METIER (et aux admins),
 * uniquement si `acceptationRisquesActive` est activé dans la configuration de l'org.
 * Accès à l'analyse (404) et rôle EFFECTIF dans son organisation (#130) : `withAccess`.
 * Pas de contrôle de gel : c'est cette décision qui gèle (ou dégèle) l'analyse.
 * Accepter / refuser : analyse SOUMIS ou APPROUVE et tous les risques cotés (n° 56, 400 avec code).
 */
export const POST = withAccess(
  { org: { analyse: 'id' }, rateLimit: { bucket: 'accept-residual-risks' } },
  async (req, { user, role, analyse }) => {
    const id = analyse.id
    const userId = user.id
    const userRole = user.role

    // La fonctionnalité doit être activée pour l'organisation de l'analyse.
    const orgConfig = await getOrgConfig(analyse.organizationId)
    // RBAC sur le rôle EFFECTIF d'org (pas l'instance) — #130.
    if (!canAcceptResidualRisks({ id: userId, role }, orgConfig.acceptationRisquesActive)) {
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

    // Décision sur un livrable abouti : analyse soumise / approuvée, risques résiduels tous cotés (n° 56).
    if (action !== 'REINITIALISER') {
      const risques = await prisma.risque.findMany({ where: { analyseId: id }, select: { niveauResiduel: true } })
      const motif = motifBlocageAcceptation(analyse.statut, resumeRisquesResiduels(risques))
      if (motif) return NextResponse.json({ error: motif }, { status: 400 })
    }

    // Four-eyes (config org) : l'auteur de l'analyse ne peut pas accepter ses propres
    // risques résiduels (décision distincte de l'auteur).
    if (action === 'ACCEPTER' && analyse.userId === userId && orgConfig.interdireAutoApprobation) {
      return NextResponse.json({ error: 'Séparation des tâches : vous ne pouvez pas accepter les risques résiduels de votre propre analyse.' }, { status: 403 })
    }

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

    // Nom de l'analyse pour le journal (non porté par le contexte d'accès).
    const nom = (await prisma.analyse.findFirst({ where: { id }, select: { nom: true } }))?.nom
    await auditLog('RESIDUAL_RISKS_DECISION', {
      userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req),
      details: { nom, statut, commentaire: commentaire?.trim() || undefined },
    })
    return NextResponse.json(updated)
  },
)
