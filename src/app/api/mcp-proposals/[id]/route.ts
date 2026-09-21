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
import { sanitizeRiskProposal, isRiskProposalValid, riskProposalToCreate } from '@/lib/mcp/proposals'

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
  if (proposal.type !== 'risk') {
    return NextResponse.json({ error: 'Type de proposition non supporté' }, { status: 400 })
  }
  if (!proposal.analyseId) return NextResponse.json({ error: 'Cible manquante' }, { status: 400 })

  // Cible : l'analyse doit être ACCESSIBLE dans le périmètre de l'utilisateur
  // (sinon 404, aucune divulgation).
  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, instanceRole, proposal.analyseId),
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
      targetId: id, targetType: 'mcp-proposal', ip, details: { decision: 'reject', type: proposal.type, analyseId: proposal.analyseId },
    })
    return NextResponse.json({ ok: true, statut: 'REJETEE' })
  }

  // accept : ré-assainit le payload stocké (défense en profondeur) puis crée le
  // risque réel et marque la proposition, de façon atomique.
  const payload = sanitizeRiskProposal(proposal.payload)
  if (!isRiskProposalValid(payload)) {
    return NextResponse.json({ error: 'Proposition invalide' }, { status: 422 })
  }
  const risque = await prisma.$transaction(async tx => {
    const r = await tx.risque.create({ data: riskProposalToCreate(payload, analyse.id), select: { id: true } })
    await tx.mcpProposal.update({
      where: { id },
      data: { statut: 'ACCEPTEE', reviewedById: userId, reviewedAt: new Date(), appliedId: r.id, reviewNote: (body.note ?? '').slice(0, 2000) || null },
    })
    return r
  })

  await auditLog('MCP_PROPOSAL_REVIEWED', {
    userId, userRole: effRole, organizationId: proposal.organizationId,
    targetId: id, targetType: 'mcp-proposal', ip, details: { decision: 'accept', type: proposal.type, analyseId: proposal.analyseId, appliedId: risque.id },
  })
  return NextResponse.json({ ok: true, statut: 'ACCEPTEE', riskId: risque.id })
}
