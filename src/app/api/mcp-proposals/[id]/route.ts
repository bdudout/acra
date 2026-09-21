// ─── File de propositions MCP (validation : accepter / rejeter) ───────────────
// L'acceptation applique le RBAC de l'ANCRE (« qui peut agir sur le parent peut
// valider » — une proposition n'élève jamais les droits) :
//  • risk / measure → ancre ANALYSE : édition de l'analyse (rôle EFFECTIF, F01) ;
//  • plan_action    → ancre org-scopée (RISQUE/CONFORMITE/CONTROLE/AUDIT/INCIDENT/
//    ANALYSE) : rôle de gouvernance de l'organisation (comme /plans-actions).
// L'ancre doit exister et être dans l'organisation (sinon 404, sans divulgation).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditAnalyse, resolveAnalyseRole, isAdminRole, type UserRole } from '@/lib/permissions'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { anchorExistsInOrg } from '@/lib/mcp/anchors.server'
import {
  sanitizeRiskProposal, isRiskProposalValid, riskProposalToCreate,
  sanitizeMeasureProposal, isMeasureProposalValid, measureProposalToCreate,
  sanitizePlanActionProposal, isPlanActionProposalValid, planActionProposalToCreate,
} from '@/lib/mcp/proposals'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

/** Rôles de gouvernance autorisés à gérer les plans d'action (cf. /plans-actions). */
function canManagePlanAction(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'DIRECTION_METIER'
}

type ApplyResult = { ok: true; appliedId: string } | { ok: false; error: string }
type Gate =
  | { ok: true; validatorRole: UserRole; apply: (userId: string, note?: string) => Promise<ApplyResult> }
  | { ok: false; status: number; error: string }

// PATCH /api/mcp-proposals/:id — { action: 'accept' | 'reject', note?: string }
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const { id } = await params
  const body = await req.json().catch(() => ({})) as { action?: string; note?: string }
  const action = body.action
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }

  const proposal = await prisma.mcpProposal.findUnique({ where: { id } })
  if (!proposal) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 })
  if (proposal.statut !== 'EN_ATTENTE') {
    return NextResponse.json({ error: 'Proposition déjà traitée' }, { status: 409 })
  }

  const gate = await resolveGate(proposal, userId, instanceRole)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const ip = getClientIp(req)
  const auditDetails = { type: proposal.type, targetType: proposal.targetType, targetId: proposal.targetId }

  if (action === 'reject') {
    await prisma.mcpProposal.update({
      where: { id },
      data: { statut: 'REJETEE', reviewedById: userId, reviewedAt: new Date(), reviewNote: (body.note ?? '').slice(0, 2000) || null },
    })
    await auditLog('MCP_PROPOSAL_REVIEWED', {
      userId, userRole: gate.validatorRole, organizationId: proposal.organizationId,
      targetId: id, targetType: 'mcp-proposal', ip, details: { decision: 'reject', ...auditDetails },
    })
    return NextResponse.json({ ok: true, statut: 'REJETEE' })
  }

  // accept : crée l'objet réel (selon le type) + marque la proposition, atomiquement.
  const applied = await gate.apply(userId, body.note)
  if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 422 })

  await auditLog('MCP_PROPOSAL_REVIEWED', {
    userId, userRole: gate.validatorRole, organizationId: proposal.organizationId,
    targetId: id, targetType: 'mcp-proposal', ip, details: { decision: 'accept', ...auditDetails, appliedId: applied.appliedId },
  })
  return NextResponse.json({ ok: true, statut: 'ACCEPTEE', appliedId: applied.appliedId })
}

type ProposalRow = NonNullable<Awaited<ReturnType<typeof prisma.mcpProposal.findUnique>>>

/**
 * Résout, selon le type de proposition, l'ancre + le rôle validateur + la fonction
 * d'application. Applique le RBAC de l'ancre (échec → status + message).
 */
async function resolveGate(proposal: ProposalRow, userId: string, instanceRole: UserRole): Promise<Gate> {
  // ── Enfants d'une ANALYSE (risque, mesure) : RBAC = édition de l'analyse ──
  if (proposal.type === 'risk' || proposal.type === 'measure') {
    if (proposal.targetType !== 'ANALYSE') return { ok: false, status: 400, error: 'Type d\'ancre non supporté' }
    const analyse = await prisma.analyse.findFirst({
      where: await analyseAccessWhere(userId, instanceRole, proposal.targetId),
      include: { accesUtilisateurs: true },
    })
    if (!analyse || analyse.deletedAt) return { ok: false, status: 404, error: 'Analyse introuvable' }
    const effRole = resolveAnalyseRole(
      instanceRole, analyse.organizationId,
      analyse.organizationId ? await getEffectiveRoleForOrg(userId, instanceRole, analyse.organizationId) : null,
    )
    if (!canEditAnalyse({ id: userId, role: effRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
      return { ok: false, status: 403, error: 'Édition non autorisée sur l\'analyse cible' }
    }
    return { ok: true, validatorRole: effRole, apply: (uid, note) => applyAnalyseChild(proposal, analyse.id, uid, note) }
  }

  // ── Plan d'action : ancre org-scopée, RBAC = gouvernance de l'organisation ──
  if (proposal.type === 'plan_action') {
    if (!(await anchorExistsInOrg(proposal.targetType, proposal.targetId, proposal.organizationId))) {
      return { ok: false, status: 404, error: 'Origine introuvable' }
    }
    const role = await getEffectiveRoleForOrg(userId, instanceRole, proposal.organizationId)
    if (!role) return { ok: false, status: 403, error: 'Organisation hors périmètre' }
    if (!canManagePlanAction(role)) return { ok: false, status: 403, error: 'Validation non autorisée' }
    return { ok: true, validatorRole: role, apply: (uid, note) => applyPlanAction(proposal, uid, note) }
  }

  return { ok: false, status: 400, error: 'Type de proposition non supporté' }
}

/** Marque une proposition ACCEPTEE dans une transaction. */
function markAccepted(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], proposalId: string, appliedId: string, userId: string, note?: string,
) {
  return tx.mcpProposal.update({
    where: { id: proposalId },
    data: { statut: 'ACCEPTEE', reviewedById: userId, reviewedAt: new Date(), appliedId, reviewNote: (note ?? '').slice(0, 2000) || null },
  })
}

/** Applique un enfant d'analyse (risque ou mesure) à l'acceptation. */
async function applyAnalyseChild(proposal: ProposalRow, analyseId: string, userId: string, note?: string): Promise<ApplyResult> {
  if (proposal.type === 'risk') {
    const payload = sanitizeRiskProposal(proposal.payload)
    if (!isRiskProposalValid(payload)) return { ok: false, error: 'Proposition invalide' }
    const appliedId = await prisma.$transaction(async tx => {
      const r = await tx.risque.create({ data: riskProposalToCreate(payload, analyseId), select: { id: true } })
      await markAccepted(tx, proposal.id, r.id, userId, note)
      return r.id
    })
    return { ok: true, appliedId }
  }
  const payload = sanitizeMeasureProposal(proposal.payload)
  if (!isMeasureProposalValid(payload)) return { ok: false, error: 'Proposition invalide' }
  const appliedId = await prisma.$transaction(async tx => {
    const m = await tx.mesure.create({ data: measureProposalToCreate(payload, analyseId), select: { id: true } })
    await markAccepted(tx, proposal.id, m.id, userId, note)
    return m.id
  })
  return { ok: true, appliedId }
}

/** Applique un plan d'action (org-scopé) + son lien polymorphe vers l'ancre. */
async function applyPlanAction(proposal: ProposalRow, userId: string, note?: string): Promise<ApplyResult> {
  const payload = sanitizePlanActionProposal(proposal.payload)
  if (!isPlanActionProposalValid(payload)) return { ok: false, error: 'Proposition invalide' }
  const appliedId = await prisma.$transaction(async tx => {
    const p = await tx.planAction.create({
      data: planActionProposalToCreate(payload, proposal.organizationId, proposal.targetType, proposal.targetId, userId),
      select: { id: true },
    })
    await markAccepted(tx, proposal.id, p.id, userId, note)
    return p.id
  })
  return { ok: true, appliedId }
}
