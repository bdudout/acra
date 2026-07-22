import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere, getAccessibleOrgIds } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { canEditAnalyse, type UserRole } from '@/lib/permissions'
import {
  calcDateFin, statutApresAvisRssi, statutApresDoubleRegard, prolongationEntry,
  canAvisRssiDerogation, canDoubleRegardDerogation, canValiderDerogation,
  canRevoquerDerogation, canCloturerDerogation,
  type DerogationStatut, type DerogationWorkflow,
} from '@/lib/derogation'
import { auditLog, getClientIp, type AuditAction } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

// Cap des preuves (data URL en base, comme les logos) : 5 max, ~1,4 Mo (≈ 1 Mo binaire) chacune.
function sanitizePreuves(v: unknown): { nom: string; mime: string; taille: number; dataUrl: string }[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 5).flatMap(p => {
    if (!p || typeof p !== 'object') return []
    const o = p as Record<string, unknown>
    const dataUrl = typeof o.dataUrl === 'string' ? o.dataUrl : ''
    if (!/^data:/.test(dataUrl) || dataUrl.length > 1_400_000) return []
    return [{
      nom: String(o.nom ?? 'preuve').slice(0, 200),
      mime: String(o.mime ?? '').slice(0, 100),
      taille: typeof o.taille === 'number' ? o.taille : dataUrl.length,
      dataUrl,
    }]
  })
}

// PATCH /api/derogations/[id] — transition du workflow (body: { action, ... }).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const sessionUser = { id: userId, role: userRole }

  const { id } = await params
  const derog = await prisma.derogation.findUnique({ where: { id } })
  if (!derog) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // Contrôle d'accès : dérogation portée par une analyse → l'analyse doit rester
  // accessible ; dérogation autonome (org) → l'organisation doit être visible.
  let peutEditer: boolean
  if (derog.analyseId) {
    const analyse = await prisma.analyse.findFirst({
      where: await analyseAccessWhere(userId, userRole, derog.analyseId),
      select: { id: true, userId: true, accesUtilisateurs: true, deletedAt: true },
    })
    if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    peutEditer = canEditAnalyse(sessionUser, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })
  } else {
    const { all, ids } = await getAccessibleOrgIds(userId, userRole)
    if (!all && !ids.includes(derog.organizationId)) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    // Pas de propriété d'analyse : le porteur (demandeur) ou un admin peut « éditer » (clôturer).
    peutEditer = derog.demandeurId === userId
  }

  const orgConfig = await getOrgConfig(derog.organizationId)
  const rbac = { statut: derog.statut as DerogationStatut, demandeurId: derog.demandeurId, avisRssiPar: derog.avisRssiPar }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action ?? '')
  const commentaire = body.commentaire != null ? String(body.commentaire).slice(0, 5000) : null
  const now = new Date()

  const audit = (a: AuditAction, details: Record<string, unknown>) =>
    auditLog(a, { userId, userRole, targetId: id, targetType: 'derogation', ip: getClientIp(req), details: { nom: derog.intitule, ...details } })

  const save = (data: Record<string, unknown>) => prisma.derogation.update({ where: { id }, data })
  // Niveau de workflow effectif + activation (fixe la période quand la dérogation devient active).
  const workflow = orgConfig.derogationWorkflow as DerogationWorkflow
  const activation = () => ({ dateDebut: derog.dateDebut ?? now, dateFin: calcDateFin(now, orgConfig.derogationDureeDefautJours), alerteeLe: null })

  switch (action) {
    // ── Avis RSSI (favorable/défavorable, + demande de double regard) ──
    case 'AVIS_RSSI': {
      if (!canAvisRssiDerogation(sessionUser, rbac)) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
      const favorable = body.favorable === true
      const doubleRegard = body.demandeDoubleRegard === true
      if (!favorable && !commentaire?.trim()) return NextResponse.json({ error: 'Un commentaire est requis pour un avis défavorable' }, { status: 400 })
      const statut = statutApresAvisRssi(favorable, doubleRegard, workflow, orgConfig.derogationDoubleRegard)
      const updated = await save({
        statut,
        avisRssiPar: userId, avisRssiLe: now, avisRssiFavorable: favorable, avisRssiCommentaire: commentaire,
        // Niveau RSSI : l'avis favorable active directement (le RSSI est le valideur).
        ...(statut === 'ACTIVE' ? { valideePar: userId, valideeLe: now, ...activation() } : {}),
        ...(statut === 'REJETEE' ? { rejeteePar: userId, rejeteeLe: now, rejetMotif: commentaire } : {}),
      })
      await audit(statut === 'ACTIVE' ? 'DEROGATION_VALIDATED' : 'DEROGATION_RSSI_OPINION', { favorable, doubleRegard, statut })
      return NextResponse.json(updated)
    }

    // ── Double regard (RSSI groupe) ──
    case 'DOUBLE_REGARD': {
      if (!canDoubleRegardDerogation(sessionUser, rbac)) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
      const favorable = body.favorable === true
      if (!favorable && !commentaire?.trim()) return NextResponse.json({ error: 'Un commentaire est requis pour un avis défavorable' }, { status: 400 })
      const statut = statutApresDoubleRegard(favorable, workflow)
      const updated = await save({
        statut,
        doubleRegardPar: userId, doubleRegardLe: now, doubleRegardFavorable: favorable, doubleRegardCommentaire: commentaire,
        ...(statut === 'ACTIVE' ? { valideePar: userId, valideeLe: now, ...activation() } : {}),
        ...(statut === 'REJETEE' ? { rejeteePar: userId, rejeteeLe: now, rejetMotif: commentaire } : {}),
      })
      await audit(statut === 'ACTIVE' ? 'DEROGATION_VALIDATED' : 'DEROGATION_DOUBLE_REVIEW', { favorable, statut })
      return NextResponse.json(updated)
    }

    // ── Validation métier → ACTIVE (ou application d'une prolongation) ──
    case 'VALIDER': {
      if (!canValiderDerogation(sessionUser, rbac)) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
      const prolongation = derog.prolongationDemandee != null
      const dateFin = prolongation ? derog.prolongationDemandee! : calcDateFin(now, orgConfig.derogationDureeDefautJours)
      const historique = prolongation
        ? [...(Array.isArray(derog.prolongations) ? derog.prolongations : []), prolongationEntry(derog.dateFin, dateFin, 'prolongation validée', userId, now)]
        : (derog.prolongations as unknown[])
      const updated = await save({
        statut: 'ACTIVE',
        valideePar: userId, valideeLe: now,
        dateDebut: derog.dateDebut ?? now,
        dateFin,
        prolongationDemandee: null,
        prolongations: historique,
        alerteeLe: null, // nouvelle période → l'alerte pourra repartir
      })
      await audit(prolongation ? 'DEROGATION_EXTENDED' : 'DEROGATION_VALIDATED', { dateFin: dateFin.toISOString() })
      return NextResponse.json(updated)
    }

    // ── Refus métier (au stade VALIDATION_METIER) ──
    case 'REJETER': {
      if (!canValiderDerogation(sessionUser, rbac)) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Un commentaire est requis pour le refus' }, { status: 400 })
      const updated = await save({ statut: 'REJETEE', rejeteePar: userId, rejeteeLe: now, rejetMotif: commentaire })
      await audit('DEROGATION_REJECTED', {})
      return NextResponse.json(updated)
    }

    // ── Demande de prolongation (rouvre un cycle de revue) ──
    case 'PROLONGER': {
      if (!(peutEditer || userRole === 'RSSI') || derog.statut !== 'ACTIVE') return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Un motif de prolongation est requis' }, { status: 400 })
      const nd = body.nouvelleDateFin ? new Date(String(body.nouvelleDateFin)) : calcDateFin(derog.dateFin ?? now, orgConfig.derogationDureeDefautJours)
      if (isNaN(nd.getTime())) return NextResponse.json({ error: 'Date de fin invalide' }, { status: 400 })
      const historique = [...(Array.isArray(derog.prolongations) ? derog.prolongations : []), prolongationEntry(derog.dateFin, nd, commentaire, userId, now)]
      // En mode AUTONOME (aucun valideur), la prolongation s'applique directement ;
      // sinon elle rouvre un cycle de revue (retour DEMANDEE).
      const updated = workflow === 'AUTONOME'
        ? await save({ statut: 'ACTIVE', dateFin: nd, prolongations: historique, alerteeLe: null })
        : await save({
            statut: 'DEMANDEE',
            prolongationDemandee: nd,
            prolongations: historique,
            avisRssiPar: null, avisRssiLe: null, avisRssiFavorable: null, avisRssiCommentaire: null,
            doubleRegardPar: null, doubleRegardLe: null, doubleRegardFavorable: null, doubleRegardCommentaire: null,
          })
      await audit('DEROGATION_EXTENDED', { requested: nd.toISOString() })
      return NextResponse.json(updated)
    }

    // ── Clôture avec preuves (non-conformité résolue) ──
    case 'CLOTURER': {
      if (!canCloturerDerogation(sessionUser, rbac, peutEditer)) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
      const preuves = sanitizePreuves(body.preuves)
      if (preuves.length === 0) return NextResponse.json({ error: 'Au moins une preuve est requise pour clôturer' }, { status: 400 })
      const updated = await save({ statut: 'CLOTUREE', clotureePar: userId, clotureeLe: now, clotureCommentaire: commentaire, preuves })
      await audit('DEROGATION_CLOSED', { preuves: preuves.length })
      return NextResponse.json(updated)
    }

    // ── Révocation d'une dérogation active ──
    case 'REVOQUER': {
      if (!canRevoquerDerogation(sessionUser, rbac)) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Un motif de révocation est requis' }, { status: 400 })
      const updated = await save({ statut: 'REVOQUEE', revoqueePar: userId, revoqueeLe: now, revoqueMotif: commentaire })
      await audit('DEROGATION_REVOKED', {})
      return NextResponse.json(updated)
    }

    default:
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  }
}
