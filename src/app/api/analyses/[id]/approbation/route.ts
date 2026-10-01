import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { lockAnalyse } from '@/lib/row-lock.server'
import { analyseAccessWhere, countOrgMembers, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { NextRequest, NextResponse } from 'next/server'
import { canSubmitAnalyse, canApproveAnalyse, canAutoValidateAnalyse, resolveAnalyseRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { applyApprobation, sanitizeApprobations } from '@/lib/projet360'
import type { Prisma } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

// POST /api/analyses/[id]/approbation
// body: { action: 'SOUMETTRE' | 'APPROUVER' | 'REJETER' | 'VALIDER', commentaire?: string }
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, userRole, id),
    include: { accesUtilisateurs: true },
  })
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { action, commentaire } = await req.json() as {
    action: 'SOUMETTRE' | 'APPROUVER' | 'REJETER' | 'VALIDER'
    commentaire?: string
  }

  const ownership = { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs }
  // RBAC sur le rôle EFFECTIF d'org (pas l'instance) — #130.
  const membershipRole = analyse.organizationId ? await getEffectiveRoleForOrg(userId, userRole, analyse.organizationId) : null
  const effRole = resolveAnalyseRole(userRole, analyse.organizationId, membershipRole)
  const sessionUser = { id: userId, role: effRole }

  // Auto-validation (organisation MONO-UTILISATEUR) : le propriétaire valide
  // directement son analyse (EN_COURS/REJETE → APPROUVE) car il n'existe aucun
  // second compte pour approuver. Journalisée `autoValidation`. La séparation des
  // tâches (#120) reprend dès qu'un 2e membre existe.
  if (action === 'VALIDER') {
    const memberCount = await countOrgMembers(analyse.organizationId)
    if (!canAutoValidateAnalyse(sessionUser, ownership, memberCount)) {
      return NextResponse.json({ error: 'Auto-validation réservée aux organisations mono-utilisateur' }, { status: 403 })
    }
    if (analyse.statut !== 'EN_COURS' && analyse.statut !== 'REJETE') {
      return NextResponse.json({ error: `Impossible de valider depuis le statut "${analyse.statut}"` }, { status: 400 })
    }
    const updated = await prisma.analyse.update({
      where: { id },
      data: { statut: 'APPROUVE', approbateurId: userId, approuveLe: new Date(), commentaireApprobation: commentaire ?? null },
    })
    await auditLog('ANALYSE_APPROVED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom: analyse.nom, commentaire, autoValidation: true } })
    return NextResponse.json(updated)
  }

  if (action === 'SOUMETTRE') {
    if (!canSubmitAnalyse(sessionUser, ownership)) {
      return NextResponse.json({ error: 'Seul le propriétaire analyste peut soumettre l\'analyse' }, { status: 403 })
    }
    if (analyse.statut !== 'EN_COURS' && analyse.statut !== 'REJETE') {
      return NextResponse.json({ error: `Impossible de soumettre depuis le statut "${analyse.statut}"` }, { status: 400 })
    }

    const updated = await prisma.analyse.update({
      where: { id },
      data: { statut: 'SOUMIS', commentaireApprobation: null, approbateurId: null, approuveLe: null, approbations: [] },
    })
    await auditLog('ANALYSE_SUBMITTED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom: analyse.nom } })
    return NextResponse.json(updated)
  }

  if (action === 'APPROUVER') {
    if (!canApproveAnalyse(sessionUser, ownership)) {
      return NextResponse.json({ error: 'Seul un Risk Manager peut approuver l\'analyse' }, { status: 403 })
    }
    // Four-eyes (config org, activé par défaut) : l'auteur ne peut pas approuver
    // sa propre analyse, même s'il en a le rôle/les droits (ex. ADMIN).
    if (analyse.userId === userId) {
      const orgConfig = await getOrgConfig(analyse.organizationId).catch(() => null)
      if (orgConfig?.interdireAutoApprobation) {
        return NextResponse.json({ error: 'Séparation des tâches : vous ne pouvez pas approuver votre propre analyse. Un second valideur est requis.' }, { status: 403 })
      }
    }
    if (analyse.statut !== 'SOUMIS') {
      return NextResponse.json({ error: 'L\'analyse doit être soumise pour être approuvée' }, { status: 400 })
    }

    // Analyse projet 360 : double approbation RSSI ET Risk Manager (personnes
    // distinctes). Le premier avis est enregistré, l'analyse reste soumise.
    if (analyse.methode === 'PROJET_360') {
      // Avis lus et écrits SOUS VERROU (audit 2026-10-01, T9) : deux approbateurs
      // simultanés (RSSI + Risk Manager) lisaient la même liste vide et le second
      // effaçait l'avis du premier, alors que le journal enregistrait les deux.
      const outcome = await prisma.$transaction(async tx => {
        await lockAnalyse(tx, id)
        const fresh = await tx.analyse.findUniqueOrThrow({ where: { id }, select: { statut: true, approbations: true } })
        if (fresh.statut !== 'SOUMIS') return { ok: false as const, error: 'L\'analyse doit être soumise pour être approuvée', status: 400 }
        const r = applyApprobation(sanitizeApprobations(fresh.approbations), { userId, role: effRole, commentaire }, new Date())
        if (!r.ok) return { ok: false as const, error: r.error, status: 409 }
        const approbations = r.approbations as unknown as Prisma.InputJsonValue
        const updated = await tx.analyse.update({
          where: { id },
          data: r.complete
            ? { statut: 'APPROUVE', approbateurId: userId, approuveLe: new Date(), commentaireApprobation: commentaire ?? null, approbations }
            : { approbations },
        })
        return { ok: true as const, r, updated }
      })
      if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status })
      const { r, updated } = outcome
      await auditLog('ANALYSE_APPROVED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom: analyse.nom, commentaire, role: effRole, complete: r.complete, approbations: r.approbations.map(a => a.role) } })
      return NextResponse.json(updated)
    }

    const updated = await prisma.analyse.update({
      where: { id },
      data: {
        statut: 'APPROUVE',
        approbateurId: userId,
        approuveLe: new Date(),
        commentaireApprobation: commentaire ?? null,
      },
    })
    // Séparation des tâches (#120) : les RISK_MANAGER/RSSI propriétaires sont bloqués
    // par canApproveAnalyse ; seul un ADMIN-propriétaire peut atteindre ce point en
    // auto-approuvant → on le rend visible en audit (`selfApproval`).
    await auditLog('ANALYSE_APPROVED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom: analyse.nom, commentaire, selfApproval: analyse.userId === userId } })
    return NextResponse.json(updated)
  }

  if (action === 'REJETER') {
    if (!canApproveAnalyse(sessionUser, ownership)) {
      return NextResponse.json({ error: 'Seul un Risk Manager peut rejeter l\'analyse' }, { status: 403 })
    }
    if (analyse.statut !== 'SOUMIS') {
      return NextResponse.json({ error: 'L\'analyse doit être soumise pour être rejetée' }, { status: 400 })
    }
    if (!commentaire?.trim()) {
      return NextResponse.json({ error: 'Un commentaire est requis pour le rejet' }, { status: 400 })
    }

    const updated = await prisma.analyse.update({
      where: { id },
      data: {
        statut: 'REJETE',
        approbateurId: userId,
        approuveLe: new Date(),
        commentaireApprobation: commentaire,
        approbations: [],
      },
    })
    await auditLog('ANALYSE_REJECTED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom: analyse.nom, commentaire } })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
