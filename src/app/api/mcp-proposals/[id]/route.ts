// ─── File de propositions MCP (validation : accepter / rejeter) ───────────────
// L'acceptation d'une proposition applique le RBAC de la RESSOURCE CIBLE : seul un
// utilisateur pouvant ÉDITER l'analyse cible (rôle EFFECTIF dans son organisation,
// cf. F01) peut accepter — l'objet réel est alors créé via le chemin normal (mêmes
// contraintes/audit). Une proposition n'élève jamais les droits.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditAnalyse, resolveAnalyseRole, type UserRole } from '@/lib/permissions'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { auditLog, getClientIp } from '@/lib/logger'
import {
  sanitizeRiskProposal, isRiskProposalValid, riskProposalToCreate,
  sanitizeMeasureProposal, isMeasureProposalValid, measureProposalToCreate,
} from '@/lib/mcp/proposals'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

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
  if (proposal.type !== 'risk' && proposal.type !== 'measure') {
    return NextResponse.json({ error: 'Type de proposition non supporté' }, { status: 400 })
  }
  // Résolution de l'ANCRE. Les propositions actuelles (risk/measure) s'ancrent à
  // une ANALYSE ; les autres types d'ancre (RISQUE/CONFORMITE/CONTROLE/AUDIT/
  // INCIDENT) seront gérés avec les outils propose_* correspondants (phase 4b).
  if (proposal.targetType !== 'ANALYSE') {
    return NextResponse.json({ error: 'Type d\'ancre non supporté' }, { status: 400 })
  }

  // Ancre : l'analyse doit être ACCESSIBLE dans le périmètre de l'utilisateur
  // (sinon 404, aucune divulgation).
  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, instanceRole, proposal.targetId),
    include: { accesUtilisateurs: true },
  })
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  // RBAC de la ressource cible : rôle EFFECTIF dans l'organisation (F01).
  const effRole = resolveAnalyseRole(
    instanceRole, analyse.organizationId,
    analyse.organizationId ? await getEffectiveRoleForOrg(userId, instanceRole, analyse.organizationId) : null,
  )
  if (!canEditAnalyse({ id: userId, role: effRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Édition non autorisée sur l\'analyse cible' }, { status: 403 })
  }

  const ip = getClientIp(req)

  if (action === 'reject') {
    await prisma.mcpProposal.update({
      where: { id },
      data: { statut: 'REJETEE', reviewedById: userId, reviewedAt: new Date(), reviewNote: (body.note ?? '').slice(0, 2000) || null },
    })
    await auditLog('MCP_PROPOSAL_REVIEWED', {
      userId, userRole: effRole, organizationId: proposal.organizationId,
      targetId: id, targetType: 'mcp-proposal', ip, details: { decision: 'reject', type: proposal.type, targetType: proposal.targetType, targetId: proposal.targetId },
    })
    return NextResponse.json({ ok: true, statut: 'REJETEE' })
  }

  // accept : ré-assainit le payload stocké (défense en profondeur), crée l'objet
  // réel selon le type, et marque la proposition — de façon atomique.
  const created = await applyAccepted(proposal.type, proposal.payload, analyse.id, id, userId, body.note)
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 422 })

  await auditLog('MCP_PROPOSAL_REVIEWED', {
    userId, userRole: effRole, organizationId: proposal.organizationId,
    targetId: id, targetType: 'mcp-proposal', ip, details: { decision: 'accept', type: proposal.type, targetType: proposal.targetType, targetId: proposal.targetId, appliedId: created.appliedId },
  })
  return NextResponse.json({ ok: true, statut: 'ACCEPTEE', appliedId: created.appliedId })
}

/**
 * Crée l'objet réel d'une proposition acceptée (risque ou mesure) et marque la
 * proposition ACCEPTEE, atomiquement. Ré-assainit le payload (défense en profondeur).
 */
async function applyAccepted(
  type: string, rawPayload: unknown, analyseId: string, proposalId: string, userId: string, note?: string,
): Promise<{ ok: true; appliedId: string } | { ok: false; error: string }> {
  const noteVal = (note ?? '').slice(0, 2000) || null
  const markAccepted = (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], appliedId: string) =>
    tx.mcpProposal.update({
      where: { id: proposalId },
      data: { statut: 'ACCEPTEE', reviewedById: userId, reviewedAt: new Date(), appliedId, reviewNote: noteVal },
    })

  if (type === 'risk') {
    const payload = sanitizeRiskProposal(rawPayload)
    if (!isRiskProposalValid(payload)) return { ok: false, error: 'Proposition invalide' }
    const appliedId = await prisma.$transaction(async tx => {
      const r = await tx.risque.create({ data: riskProposalToCreate(payload, analyseId), select: { id: true } })
      await markAccepted(tx, r.id)
      return r.id
    })
    return { ok: true, appliedId }
  }

  // type === 'measure'
  const payload = sanitizeMeasureProposal(rawPayload)
  if (!isMeasureProposalValid(payload)) return { ok: false, error: 'Proposition invalide' }
  const appliedId = await prisma.$transaction(async tx => {
    const m = await tx.mesure.create({ data: measureProposalToCreate(payload, analyseId), select: { id: true } })
    await markAccepted(tx, m.id)
    return m.id
  })
  return { ok: true, appliedId }
}
