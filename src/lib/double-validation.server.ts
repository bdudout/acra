// ─── Double validation : création, décision et exécution des demandes (cf. lib/double-validation) ───────────────────
// L'action demandée n'est exécutée qu'à l'APPROBATION, dans la même transaction que la décision, après un nouveau contrôle
// des conditions (la cible a pu changer ou disparaître entre-temps). Chaque étape est journalisée.
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { roleSurRessource } from '@/lib/org-context.server'
import { auditLog } from '@/lib/logger'
import { canAcceptResidualRisks, peutGererRegistreTic, peutGouvernerAppetit, type UserRole } from '@/lib/permissions'
import { motifBlocageAcceptation, resumeRisquesResiduels } from '@/lib/acceptation-residuels'
import { controlerDecision, MAX_MOTIF, type DecisionDemande, type TypeDemande } from '@/lib/double-validation'

type Demande = { id: string; organizationId: string; type: string; cibleId: string; libelle: string; payload: Prisma.JsonValue; statut: string; demandeurId: string }

/**
 * Crée la demande, ou renvoie celle déjà EN_ATTENTE pour la même action sur la même cible (aucun doublon).
 * `existante` = true dans ce dernier cas.
 */
export async function creerDemande(input: { organizationId: string; type: TypeDemande; cibleId: string; libelle: string; payload?: Record<string, unknown>; demandeurId: string; demandeurRole: string; ip?: string }) {
  const existante = await prisma.demandeValidation.findFirst({ where: { type: input.type, cibleId: input.cibleId, statut: 'EN_ATTENTE' } })
  if (existante) return { demande: existante, existante: true }
  const demande = await prisma.demandeValidation.create({ data: {
    organizationId: input.organizationId, type: input.type, cibleId: input.cibleId, libelle: input.libelle.slice(0, 300),
    payload: (input.payload ?? {}) as Prisma.InputJsonValue, demandeurId: input.demandeurId,
  } })
  await auditLog('DOUBLE_VALIDATION_DEMANDEE', { userId: input.demandeurId, userRole: input.demandeurRole, organizationId: input.organizationId, ip: input.ip, targetId: input.cibleId, details: { demandeId: demande.id, type: input.type, libelle: demande.libelle } })
  return { demande, existante: false }
}

/** Droit de trancher une demande, évalué sur le rôle effectif DANS l'organisation de la demande. */
export async function peutTrancher(demande: Pick<Demande, 'type' | 'organizationId' | 'cibleId'>, role: UserRole, userId: string): Promise<boolean> {
  if (demande.type === 'SUPPRESSION_CONTRAT_TIC') return peutGererRegistreTic(role)
  if (demande.type === 'ACCEPTATION_RISQUE_REGISTRE') return peutGouvernerAppetit(role)
  if (demande.type === 'ACCEPTATION_RISQUES_ANALYSE') {
    const cfg = await getOrgConfig(demande.organizationId)
    if (!canAcceptResidualRisks({ id: userId, role }, cfg.acceptationRisquesActive)) return false
    if (cfg.interdireAutoApprobation) {
      const a = await prisma.analyse.findUnique({ where: { id: demande.cibleId }, select: { userId: true } })
      if (a?.userId === userId) return false // l'auteur de l'analyse n'accepte pas ses propres risques
    }
    return true
  }
  return false
}

type Execution = { ok: true } | { ok: false; error: string }
/** Exécute l'action approuvée (dans la transaction de la décision) après avoir revérifié ses conditions. */
async function executer(tx: Prisma.TransactionClient, d: Demande): Promise<Execution> {
  const payload = (d.payload ?? {}) as Record<string, unknown>
  if (d.type === 'SUPPRESSION_CONTRAT_TIC') {
    const a = await tx.arrangementTic.findFirst({ where: { id: d.cibleId, organizationId: d.organizationId }, select: { id: true } })
    if (!a) return { ok: false, error: 'cible_introuvable' }
    await tx.arrangementTic.delete({ where: { id: a.id } })
    return { ok: true }
  }
  if (d.type === 'ACCEPTATION_RISQUE_REGISTRE') {
    const r = await tx.riskItem.findFirst({ where: { id: d.cibleId, organizationId: d.organizationId }, select: { id: true } })
    if (!r) return { ok: false, error: 'cible_introuvable' }
    await tx.riskItem.update({ where: { id: r.id }, data: { statut: 'ACCEPTE' } })
    return { ok: true }
  }
  if (d.type === 'ACCEPTATION_RISQUES_ANALYSE') {
    const a = await tx.analyse.findFirst({ where: { id: d.cibleId, organizationId: d.organizationId }, select: { id: true, statut: true } })
    if (!a) return { ok: false, error: 'cible_introuvable' }
    const risques = await tx.risque.findMany({ where: { analyseId: a.id }, select: { niveauResiduel: true } })
    const motif = motifBlocageAcceptation(a.statut, resumeRisquesResiduels(risques))
    if (motif) return { ok: false, error: motif }
    const commentaire = typeof payload.commentaire === 'string' && payload.commentaire.trim() ? payload.commentaire.trim() : null
    await tx.analyse.update({ where: { id: a.id }, data: { risquesResiduelsStatut: 'ACCEPTES', risquesResiduelsPar: d.demandeurId, risquesResiduelsLe: new Date(), risquesResiduelsCommentaire: commentaire } })
    return { ok: true }
  }
  return { ok: false, error: 'type_inconnu' }
}

/**
 * Tranche une demande : APPROUVER (exécute l'action), REJETER (motif obligatoire), ANNULER (demandeur seulement).
 * Concurrence : la demande n'est close qu'une fois (mise à jour conditionnée au statut EN_ATTENTE).
 */
export async function trancherDemande(input: { demandeId: string; userId: string; instanceRole: UserRole; decision: DecisionDemande; motif?: string | null; ip?: string }):
  Promise<{ ok: true; statut: string } | { ok: false; status: number; error: string }> {
  const d = await prisma.demandeValidation.findUnique({ where: { id: input.demandeId } })
  if (!d) return { ok: false, status: 404, error: 'not_found' }
  const role = await roleSurRessource(input.userId, input.instanceRole, d.organizationId)
  const motif = input.motif?.trim().slice(0, MAX_MOTIF) || null
  const autorise = input.decision === 'ANNULER' ? true : await peutTrancher(d, role, input.userId)
  const err = controlerDecision({ statut: d.statut, demandeurId: d.demandeurId, valideurId: input.userId, decision: input.decision, autorise, motif })
  if (err) return { ok: false, status: err === 'demande_close' ? 409 : err === 'motif_requis' ? 400 : 403, error: err }
  const statut = input.decision === 'APPROUVER' ? 'APPROUVEE' : input.decision === 'REJETER' ? 'REJETEE' : 'ANNULEE'
  const res = await prisma.$transaction(async tx => {
    const close = await tx.demandeValidation.updateMany({ where: { id: d.id, statut: 'EN_ATTENTE' }, data: { statut, valideurId: input.userId, motifDecision: motif, decideLe: new Date() } })
    if (close.count === 0) return { ok: false as const, status: 409, error: 'demande_close' }
    if (input.decision === 'APPROUVER') {
      const ex = await executer(tx, d)
      if (!ex.ok) throw Object.assign(new Error(ex.error), { code: ex.error })
    }
    return { ok: true as const, statut }
  }).catch((e: { code?: string }) => ({ ok: false as const, status: 409, error: e.code ?? 'execution_impossible' }))
  if (res.ok) await auditLog('DOUBLE_VALIDATION_DECIDEE', { userId: input.userId, userRole: role, organizationId: d.organizationId, ip: input.ip, targetId: d.cibleId, details: { demandeId: d.id, type: d.type, libelle: d.libelle, statut, demandeurId: d.demandeurId, motif: motif ?? undefined } })
  return res
}
