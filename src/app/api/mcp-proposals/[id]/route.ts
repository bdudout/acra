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
import { lockConformite } from '@/lib/row-lock.server'
import { canCreateAnalyse, canEditAnalyse, peutGererConformite, peutGererReferentiels, resolveAnalyseRole, isAdminRole, type UserRole } from '@/lib/permissions'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { getOrgConfig, optionsStructure } from '@/lib/org-config.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { createAnalyseRiskPlanAction } from '@/lib/plan-action.server'
import { isProjet360ProposalValid, sanitizeProjet360Proposal } from '@/lib/mcp/projet360-proposal'
import { creerProjet360 } from '@/lib/projet360-creation.server'
import { plafondDemoAtteint } from '@/lib/analyse-create-guard.server'
import { analyseGelee } from '@/lib/gel-analyse'
import { anchorExistsInOrg } from '@/lib/mcp/anchors.server'
import {
  sanitizeRiskProposal, isRiskProposalValid, riskProposalToCreate,
  sanitizeMeasureProposal, isMeasureProposalValid, measureProposalToCreate,
  sanitizePlanActionProposal, isPlanActionProposalValid, planActionProposalToCreate,
  sanitizeConformiteProposal, isConformiteProposalValid,
} from '@/lib/mcp/proposals'
import { sanitizeConformite, applyConformiteEntry } from '@/lib/conformite'
import type { Prisma } from '@prisma/client'
import { applyAnalysisImportContent, executeAnalysisImport, parseAnalysisImportRequest } from '@/lib/analysis-import'
import { isPssiProposalValid, sanitizePssiProposal } from '@/lib/mcp/pssi-proposal'
import { importerPssi } from '@/lib/mcp/pssi-import.server'
import { usesConformiteEntity } from '@/lib/conformite-config'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

/** Rôles de gouvernance autorisés à gérer les plans d'action (cf. /plans-actions). */
function canManagePlanAction(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'DIRECTION_METIER'
}

/** Rôles autorisés à gérer la conformité d'une organisation (cf. /organizations/[orgId]/conformite). */
/** Gestion de la conformité : même règle que l'écran (gouvernance, dont CONFORMITE et DPO). */
const canManageOrgConformite = (role: UserRole): boolean => peutGererConformite(role)

type ApplyResult = { ok: true; appliedId: string } | { ok: false; error: string; status?: number }
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
  if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: applied.status ?? 422 })

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
  if (proposal.type === 'risk' || proposal.type === 'measure' || proposal.type === 'analysis_import') {
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
    // Gel après acceptation des risques résiduels : aucune écriture dans l'analyse
    // (même garde que la saisie directe) ; le rejet reste possible.
    const orgConfig = await getOrgConfig(analyse.organizationId)
    if (analyseGelee(analyse.risquesResiduelsStatut, orgConfig.gelApresAcceptationActive)) {
      return { ok: true, validatorRole: effRole, apply: async () => ({ ok: false, status: 403, error: 'ANALYSE_GELEE' }) }
    }
    return { ok: true, validatorRole: effRole, apply: (uid, note) => proposal.type === 'analysis_import' ? applyAnalysisImportProposal(proposal, analyse.id, uid, note) : applyAnalyseChild(proposal, analyse.id, uid, note) }
  }

  // ── Projet 360 : ancre = l'organisation ; RBAC = droit de créer une analyse (comme le formulaire) ──
  if (proposal.type === 'projet360') {
    if (proposal.targetType !== 'ORGANISATION' || !(await anchorExistsInOrg('ORGANISATION', proposal.targetId, proposal.organizationId))) {
      return { ok: false, status: 400, error: 'Type d\'ancre non supporté' }
    }
    const role = await getEffectiveRoleForOrg(userId, instanceRole, proposal.organizationId)
    if (!role) return { ok: false, status: 403, error: 'Organisation hors périmètre' }
    if (!canCreateAnalyse({ id: userId, role }, await optionsStructure(proposal.organizationId))) return { ok: false, status: 403, error: 'Validation non autorisée' }
    const cfg = await getOrgConfig(proposal.organizationId)
    if (!cfg.projets360Active) return { ok: false, status: 403, error: 'Module Projets 360 désactivé' }
    // Plafond d'analyses de l'instance de démonstration (comme le formulaire) ; le rejet reste possible.
    if (await plafondDemoAtteint(proposal.organizationId)) return { ok: true, validatorRole: role, apply: async () => ({ ok: false, status: 403, error: 'DEMO_CAP' }) }
    return { ok: true, validatorRole: role, apply: (uid, note) => applyProjet360(proposal, cfg.patternsArchiMax, uid, note) }
  }

  // ── Nouvelle analyse (expression de besoins ou analyse historique) : même règle que le projet 360 ──
  if (proposal.type === 'analysis_create') {
    if (proposal.targetType !== 'ORGANISATION' || !(await anchorExistsInOrg('ORGANISATION', proposal.targetId, proposal.organizationId))) {
      return { ok: false, status: 400, error: 'Type d\'ancre non supporté' }
    }
    const role = await getEffectiveRoleForOrg(userId, instanceRole, proposal.organizationId)
    if (!role) return { ok: false, status: 403, error: 'Organisation hors périmètre' }
    if (!canCreateAnalyse({ id: userId, role }, await optionsStructure(proposal.organizationId))) return { ok: false, status: 403, error: 'Validation non autorisée' }
    if (await plafondDemoAtteint(proposal.organizationId)) return { ok: true, validatorRole: role, apply: async () => ({ ok: false, status: 403, error: 'DEMO_CAP' }) }
    return { ok: true, validatorRole: role, apply: (uid, note) => applyNouvelleAnalyse(proposal, uid, note) }
  }

  // ── PSSI : ancre = l'organisation ; RBAC = création d'un référentiel (administrateur), module conformité actif ──
  if (proposal.type === 'pssi') {
    if (proposal.targetType !== 'ORGANISATION' || !(await anchorExistsInOrg('ORGANISATION', proposal.targetId, proposal.organizationId))) {
      return { ok: false, status: 400, error: 'Type d\'ancre non supporté' }
    }
    const role = await getEffectiveRoleForOrg(userId, instanceRole, proposal.organizationId)
    if (!role) return { ok: false, status: 403, error: 'Organisation hors périmètre' }
    if (!peutGererReferentiels(role)) return { ok: false, status: 403, error: 'Validation non autorisée' }
    const cfg = await getOrgConfig(proposal.organizationId)
    if (!cfg.conformiteActive) return { ok: false, status: 403, error: 'Module conformité désactivé' }
    return { ok: true, validatorRole: role, apply: (uid, note) => applyPssi(proposal, usesConformiteEntity(cfg.conformiteNiveau), uid, note) }
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

  // ── Conformité : ancre CONFORMITE (référentiel org), RBAC = gestion conformité ──
  if (proposal.type === 'conformite') {
    if (proposal.targetType !== 'CONFORMITE') return { ok: false, status: 400, error: 'Type d\'ancre non supporté' }
    if (!(await anchorExistsInOrg('CONFORMITE', proposal.targetId, proposal.organizationId))) {
      return { ok: false, status: 404, error: 'Référentiel de conformité introuvable' }
    }
    const role = await getEffectiveRoleForOrg(userId, instanceRole, proposal.organizationId)
    if (!role) return { ok: false, status: 403, error: 'Organisation hors périmètre' }
    if (!canManageOrgConformite(role)) return { ok: false, status: 403, error: 'Validation non autorisée' }
    return { ok: true, validatorRole: role, apply: (uid, note) => applyConformite(proposal, uid, note) }
  }

  return { ok: false, status: 400, error: 'Type de proposition non supporté' }
}

/** Crée le projet 360 proposé (mêmes briques que le formulaire) puis marque la proposition acceptée. */
async function applyProjet360(proposal: ProposalRow, patternsMax: number, userId: string, note?: string): Promise<ApplyResult> {
  const payload = sanitizeProjet360Proposal(proposal.payload, { patternsMax })
  if (!isProjet360ProposalValid(payload)) return { ok: false, error: 'Proposition invalide' }
  const { id } = await creerProjet360(payload, { userId, organizationId: proposal.organizationId })
  await prisma.mcpProposal.update({ where: { id: proposal.id }, data: { statut: 'ACCEPTEE', reviewedById: userId, reviewedAt: new Date(), appliedId: id, reviewNote: (note ?? '').slice(0, 2000) || null } })
  return { ok: true, appliedId: id }
}

/** Crée la nouvelle analyse par l'import historique (transaction et reçu d'idempotence), le relecteur en est le créateur. */
async function applyNouvelleAnalyse(proposal: ProposalRow, userId: string, note?: string): Promise<ApplyResult> {
  let payload
  try { payload = parseAnalysisImportRequest(proposal.payload) } catch { return { ok: false, error: 'Proposition d’analyse invalide' } }
  const res = await executeAnalysisImport(payload, { organizationId: proposal.organizationId, userId, source: 'MCP' })
  const appliedId = (res as { analyseId: string }).analyseId
  await prisma.mcpProposal.update({ where: { id: proposal.id }, data: { statut: 'ACCEPTEE', reviewedById: userId, reviewedAt: new Date(), appliedId, reviewNote: (note ?? '').slice(0, 2000) || null } })
  return { ok: true, appliedId }
}

/** Importe la PSSI : référentiel PSSI, document de la bibliothèque et suivi de conformité (cf. pssi-import.server). */
async function applyPssi(proposal: ProposalRow, suiviPossible: boolean, userId: string, note?: string): Promise<ApplyResult> {
  const payload = sanitizePssiProposal(proposal.payload)
  if (!isPssiProposalValid(payload)) return { ok: false, error: 'Proposition invalide' }
  const res = await importerPssi(payload, { organizationId: proposal.organizationId, userId, proposalId: proposal.id, note, suiviConformite: payload.suivreConformite && suiviPossible })
  return res.ok ? { ok: true, appliedId: res.referentielId } : { ok: false, error: res.error, status: res.status }
}

/** Applique atomiquement le paquet MCP après l'accord explicite du relecteur. */
async function applyAnalysisImportProposal(proposal: ProposalRow, analyseId: string, userId: string, note?: string): Promise<ApplyResult> {
  try {
    const payload = parseAnalysisImportRequest(proposal.payload)
    await applyAnalysisImportContent(payload, { organizationId: proposal.organizationId, userId, analyseId })
    await prisma.mcpProposal.update({ where: { id: proposal.id }, data: { statut: 'ACCEPTEE', reviewedById: userId, reviewedAt: new Date(), appliedId: analyseId, reviewNote: (note ?? '').slice(0, 2000) || null } })
    return { ok: true, appliedId: analyseId }
  } catch { return { ok: false, error: 'Proposition d’import invalide' } }
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
    // Ré-assaini à l'acceptation sur l'échelle ACTUELLE de l'organisation (elle a pu changer depuis le dépôt).
    const { nbNiveaux } = await getEffectiveScaleConfig(proposal.organizationId)
    const payload = sanitizeRiskProposal(proposal.payload, nbNiveaux)
    if (!isRiskProposalValid(payload)) return { ok: false, error: 'Proposition invalide' }
    const appliedId = await prisma.$transaction(async tx => {
      const r = await tx.risque.create({ data: riskProposalToCreate(payload, analyseId), select: { id: true, nom: true } })
      // Mesures et plans proposés avec le risque : créés dans la même transaction (plans liés RISQUE_ANALYSE).
      if (payload.mesures?.length) {
        await tx.mesure.createMany({ data: payload.mesures.map(m => ({ analyseId, risqueId: r.id, nom: m.nom, type: m.type, statut: 'A_FAIRE' as const })) })
      }
      for (const pl of payload.plans ?? []) {
        await createAnalyseRiskPlanAction(tx, {
          organizationId: proposal.organizationId, risqueId: r.id, analyseId, titre: pl.titre, porteur: pl.porteur ?? null,
          echeance: pl.echeance ? new Date(pl.echeance) : null, priorite: pl.priorite, createdById: userId, riskLabel: r.nom,
        })
      }
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

/** Applique un statut de conformité (par `ref`) aux entrées du référentiel cible. */
async function applyConformite(proposal: ProposalRow, userId: string, note?: string): Promise<ApplyResult> {
  const payload = sanitizeConformiteProposal(proposal.payload)
  if (!isConformiteProposalValid(payload)) return { ok: false, error: 'Proposition invalide' }
  const record = await prisma.conformite.findFirst({
    where: { id: proposal.targetId, organizationId: proposal.organizationId },
    select: { id: true },
  })
  if (!record) return { ok: false, error: 'Référentiel de conformité introuvable' }
  const appliedId = await prisma.$transaction(async tx => {
    // Fusion sous verrou de ligne (audit 2026-09-30, D2).
    await lockConformite(tx, record.id)
    const fresh = await tx.conformite.findUniqueOrThrow({ where: { id: record.id }, select: { entries: true } })
    const next = applyConformiteEntry(sanitizeConformite(fresh.entries), payload.ref, { statut: payload.statut, commentaire: payload.commentaire ?? null })
    await tx.conformite.update({ where: { id: record.id }, data: { entries: next as unknown as Prisma.InputJsonValue } })
    await markAccepted(tx, proposal.id, record.id, userId, note)
    return record.id
  })
  return { ok: true, appliedId }
}
