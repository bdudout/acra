import { prisma } from '@/lib/prisma'
import { lockAnalyse } from '@/lib/row-lock.server'
import { countOrgMembers } from '@/lib/org-context.server'
import { getOrgConfig, optionsStructure } from '@/lib/org-config.server'
import { NextResponse } from 'next/server'
import { canSubmitAnalyse, canApproveAnalyse, canAutoValidateAnalyse } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { applyApprobation, sanitizeApprobations } from '@/lib/projet360'
import type { Prisma } from '@prisma/client'

// POST /api/analyses/[id]/approbation
// body: { action: 'SOUMETTRE' | 'APPROUVER' | 'REJETER' | 'VALIDER', commentaire?: string }
// Accès à l'analyse (404) et rôle EFFECTIF dans son organisation (#130) : `withAccess` (sans `write` :
// la soumission/approbation relève de ses propres permissions, évaluées ci-dessous, et n'est pas soumise au gel).
export const POST = withAccess({ org: { analyse: 'id' }, rateLimit: { bucket: 'approbation' } }, async (req, { user, role: effRole, analyse }) => {
  const id = analyse.id
  const userId = user.id
  const userRole = user.role
  // Nom de l'analyse pour le journal (non porté par le contexte d'accès).
  const nom = (await prisma.analyse.findFirst({ where: { id }, select: { nom: true } }))?.nom

  const { action, commentaire } = await req.json() as {
    action: 'SOUMETTRE' | 'APPROUVER' | 'REJETER' | 'VALIDER'
    commentaire?: string
  }

  const ownership = { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs }
  // RBAC sur le rôle EFFECTIF d'org (pas l'instance) — #130 (résolu par withAccess).
  const sessionUser = { id: userId, role: effRole }
  // Petite structure : cumul RSSI + gestionnaire des risques + analyste (quatre-yeux relâché, journalisé).
  const structure = await optionsStructure(analyse.organizationId)

  // Auto-validation (organisation MONO-UTILISATEUR) : le propriétaire valide
  // directement son analyse (EN_COURS/REJETE → APPROUVE) car il n'existe aucun
  // second compte pour approuver. Journalisée `autoValidation`. La séparation des
  // tâches (#120) reprend dès qu'un 2e membre existe.
  if (action === 'VALIDER') {
    const memberCount = await countOrgMembers(analyse.organizationId)
    if (!canAutoValidateAnalyse(sessionUser, ownership, memberCount, structure)) {
      return NextResponse.json({ error: 'Auto-validation réservée aux organisations mono-utilisateur' }, { status: 403 })
    }
    if (analyse.statut !== 'EN_COURS' && analyse.statut !== 'REJETE') {
      return NextResponse.json({ error: `Impossible de valider depuis le statut "${analyse.statut}"` }, { status: 400 })
    }
    const updated = await prisma.analyse.update({
      where: { id },
      data: { statut: 'APPROUVE', approbateurId: userId, approuveLe: new Date(), commentaireApprobation: commentaire ?? null },
    })
    await auditLog('ANALYSE_APPROVED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom, commentaire, autoValidation: true, petiteStructure: structure.petiteStructure } })
    return NextResponse.json(updated)
  }

  if (action === 'SOUMETTRE') {
    if (!canSubmitAnalyse(sessionUser, ownership, structure)) {
      return NextResponse.json({ error: 'Seul le propriétaire analyste peut soumettre l\'analyse' }, { status: 403 })
    }
    if (analyse.statut !== 'EN_COURS' && analyse.statut !== 'REJETE') {
      return NextResponse.json({ error: `Impossible de soumettre depuis le statut "${analyse.statut}"` }, { status: 400 })
    }

    const updated = await prisma.analyse.update({
      where: { id },
      data: { statut: 'SOUMIS', soumisLe: new Date(), commentaireApprobation: null, approbateurId: null, approuveLe: null, approbations: [] },
    })
    await auditLog('ANALYSE_SUBMITTED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom } })
    return NextResponse.json(updated)
  }

  if (action === 'APPROUVER') {
    if (!canApproveAnalyse(sessionUser, ownership, structure)) {
      return NextResponse.json({ error: 'Seul un Risk Manager peut approuver l\'analyse' }, { status: 403 })
    }
    // Four-eyes (config org, activé par défaut) : l'auteur ne peut pas approuver
    // sa propre analyse, même s'il en a le rôle/les droits (ex. ADMIN).
    if (analyse.userId === userId) {
      const orgConfig = await getOrgConfig(analyse.organizationId).catch(() => null)
      if (orgConfig?.interdireAutoApprobation && !orgConfig.petiteStructure) {
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
        const r = applyApprobation(sanitizeApprobations(fresh.approbations), { userId, role: effRole, commentaire }, new Date(), structure)
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
      await auditLog('ANALYSE_APPROVED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom, commentaire, role: effRole, complete: r.complete, approbations: r.approbations.map(a => a.role), cumul: r.approbations.some(a => a.cumul), selfApproval: analyse.userId === userId } })
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
    await auditLog('ANALYSE_APPROVED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom, commentaire, selfApproval: analyse.userId === userId, petiteStructure: structure.petiteStructure } })
    return NextResponse.json(updated)
  }

  if (action === 'REJETER') {
    if (!canApproveAnalyse(sessionUser, ownership, structure)) {
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
    await auditLog('ANALYSE_REJECTED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom, commentaire } })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
})
