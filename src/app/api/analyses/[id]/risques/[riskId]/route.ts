// ─── Saisie directe — mise à jour / suppression d'un risque ──────────────────
// PATCH  — met à jour un risque (recalcule le niveau si G ou V change).
// DELETE — supprime un risque.
// Mêmes gardes que la collection (accès, méthode à saisie directe, édition, gel)
// + le risque doit appartenir à l'analyse ciblée (sinon 404, sans divulgation).

import { decisionSuppression, peutValiderSuppression, validateurSuppression } from '@/lib/projet360-suppression'
import { violationsCotation } from '@/lib/cotation-risque'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk, guardValidationSuppression } from '@/lib/analyse-direct-risk.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { sanitizeDirectRisquePatch, recomputeDirectNiveaux, DIRECT_RISK_SELECT } from '@/lib/risque-direct'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; riskId: string }> }

function auth(session: unknown): { userId: string; role: UserRole } | null {
  const u = (session as { user?: { id?: string; role?: string } } | null)?.user
  if (!u?.id) return null
  return { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole }
}

/** Charge un risque en s'assurant qu'il appartient bien à l'analyse ciblée. */
async function riskOfAnalyse(riskId: string, analyseId: string) {
  return prisma.risque.findFirst({
    where: { id: riskId, analyseId },
    select: {
      id: true, gravite: true, vraisemblance: true,
      graviteActuelle: true, vraisemblanceActuelle: true,
      graviteResiduelle: true, vraisemblanceResiduelle: true,
      domaine: true, suppressionDemandeeLe: true,
    },
  })
}

// PATCH /api/analyses/:id/risques/:riskId
export async function PATCH(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, riskId } = await params
  const raw = await req.json().catch(() => ({})) as Record<string, unknown>
  // Le validateur d'une demande de suppression (projet 360) peut ne pas avoir le droit d'éditer : garde dédiée.
  const g = raw.refuserSuppression === true ? await guardValidationSuppression(id, a.userId, a.role) : await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const existing = await riskOfAnalyse(riskId, g.analyse.id)
  if (!existing) return NextResponse.json({ error: 'Risque introuvable' }, { status: 404 })

  // Projet 360 : refus d'une demande de suppression, par le validateur (RM, ou RSSI si risque cyber).
  if (raw.refuserSuppression === true) {
    if (!existing.suppressionDemandeeLe || !peutValiderSuppression(g.role ?? a.role, existing.domaine, { petiteStructure: g.petiteStructure })) return NextResponse.json({ error: 'Validation non autorisée' }, { status: 403 })
    const risque = await prisma.risque.update({ where: { id: riskId }, data: { suppressionDemandeePar: null, suppressionDemandeeLe: null }, select: DIRECT_RISK_SELECT })
    await auditLog('WORKSHOP_SAVED', { userId: a.userId, userRole: g.role ?? a.role, organizationId: g.analyse.organizationId, targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req), details: { scope: 'risque-direct', action: 'suppression-refusee', riskId } })
    return NextResponse.json({ risque })
  }
  // Cotation bornée par l'échelle de l'organisation (4 ou 5 niveaux).
  const { nbNiveaux } = await getEffectiveScaleConfig(g.analyse.organizationId)
  const patch = sanitizeDirectRisquePatch(raw, nbNiveaux)
  if (patch.nom !== undefined && patch.nom.trim() === '') {
    return NextResponse.json({ error: 'intitule_requis' }, { status: 400 })
  }
  // Cohérence de la cotation (actuel ≤ brut, résiduel ≤ actuel), contrôlée seulement si la requête la modifie.
  const COTATION = ['gravite', 'vraisemblance', 'graviteActuelle', 'vraisemblanceActuelle', 'graviteResiduelle', 'vraisemblanceResiduelle'] as const
  if (COTATION.some(k => (patch as Record<string, unknown>)[k] !== undefined)) {
    const violations = violationsCotation({ ...existing, ...patch } as Parameters<typeof violationsCotation>[0])
    if (violations.length) return NextResponse.json({ error: 'cotation_incoherente', violations }, { status: 400 })
  }
  // Recalcule les niveaux (brut/actuel/résiduel) touchés, valeurs FUSIONNÉES (existant ⊕ patch).
  const data: Record<string, unknown> = { ...patch, ...recomputeDirectNiveaux(patch, existing) }

  const risque = await prisma.risque.update({
    where: { id: riskId },
    data,
    select: DIRECT_RISK_SELECT,
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-direct', action: 'update', riskId },
  })
  return NextResponse.json({ risque })
}

// DELETE /api/analyses/:id/risques/:riskId
export async function DELETE(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, riskId } = await params
  const edition = await guardDirectRisk(id, a.userId, a.role)
  // Sans droit d'édition, seul le validateur d'une demande en attente peut supprimer (validation).
  const g = edition.ok ? edition : await guardValidationSuppression(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: edition.ok ? g.error : (edition as { error: string }).error }, { status: edition.ok ? g.status : (edition as { status: number }).status })

  const existing = await riskOfAnalyse(riskId, g.analyse.id)
  if (!existing) return NextResponse.json({ error: 'Risque introuvable' }, { status: 404 })
  if (!edition.ok && !(existing.suppressionDemandeeLe && peutValiderSuppression(g.role ?? a.role, existing.domaine, { petiteStructure: g.petiteStructure }))) {
    return NextResponse.json({ error: (edition as { error: string }).error }, { status: (edition as { status: number }).status })
  }

  // Projet 360 (selon la configuration) : hors validateur, la suppression devient une demande à valider.
  const role = g.role ?? a.role
  if (decisionSuppression({ methode: g.analyse.methode, validationActive: !!g.projetSuppressionValidation, role, domaine: existing.domaine, petiteStructure: g.petiteStructure }) === 'DEMANDER') {
    const risque = await prisma.risque.update({ where: { id: riskId }, data: { suppressionDemandeePar: a.userId, suppressionDemandeeLe: new Date() }, select: DIRECT_RISK_SELECT })
    await auditLog('WORKSHOP_SAVED', { userId: a.userId, userRole: role, organizationId: g.analyse.organizationId, targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req), details: { scope: 'risque-direct', action: 'suppression-demandee', riskId } })
    return NextResponse.json({ pending: true, validateur: validateurSuppression(existing.domaine), risque }, { status: 202 })
  }

  await prisma.risque.delete({ where: { id: riskId } })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-direct', action: existing.suppressionDemandeeLe ? 'suppression-validee' : 'delete', riskId },
  })
  return NextResponse.json({ ok: true })
}
