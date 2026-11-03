// ─── Double validation (quatre yeux), activable par organisation ─────────────────────────────────────────────────────
// Quand `doubleValidationActive` est activé, certaines actions ne s'exécutent pas directement : elles deviennent une
// demande qu'une SECONDE personne habilitée approuve (l'action est alors exécutée) ou rejette (motif obligatoire).
//  • ACCEPTATION_RISQUES_ANALYSE : accepter les risques résiduels d'une analyse dont au moins un est hors appétit ;
//  • ACCEPTATION_RISQUE_REGISTRE : passer un risque du registre au statut ACCEPTE alors qu'il est hors appétit ;
//  • SUPPRESSION_CONTRAT_TIC : supprimer un contrat du registre TIC critique ou important (fonction critique ou
//    importante au sens DORA).
// Logique pure et testée (double-validation.test.ts) ; l'exécution est dans double-validation.server.ts.
import { estHorsAppetit, type AppetitConfig } from './appetit'

export const TYPES_DEMANDE = ['ACCEPTATION_RISQUES_ANALYSE', 'ACCEPTATION_RISQUE_REGISTRE', 'SUPPRESSION_CONTRAT_TIC'] as const
export type TypeDemande = typeof TYPES_DEMANDE[number]
export const STATUTS_DEMANDE = ['EN_ATTENTE', 'APPROUVEE', 'REJETEE', 'ANNULEE'] as const
export type DecisionDemande = 'APPROUVER' | 'REJETER' | 'ANNULER'
export const MAX_MOTIF = 2000

/** Nombre de risques résiduels d'une analyse au-dessus du seuil d'appétit applicable (catégorie, sinon global). */
export function risquesHorsAppetit(risques: { niveauResiduel: number | null; taxonomieCode: string | null }[], appetit: AppetitConfig): number {
  return risques.filter(r => estHorsAppetit({ niveauResiduel: r.niveauResiduel, taxonomieCode: r.taxonomieCode }, appetit)).length
}

/** Risque du registre hors appétit : résiduel = gravité × vraisemblance résiduelles (non coté = non évaluable). */
export function risqueRegistreHorsAppetit(r: { graviteResiduelle: number | null; vraisemblanceResiduelle: number | null; taxonomieCode: string | null }, appetit: AppetitConfig): boolean {
  const niveau = r.graviteResiduelle != null && r.vraisemblanceResiduelle != null ? r.graviteResiduelle * r.vraisemblanceResiduelle : null
  return estHorsAppetit({ niveauResiduel: niveau, taxonomieCode: r.taxonomieCode }, appetit)
}

/** Contrat TIC soumis à double validation pour sa suppression : critique ou important. */
export function contratTicCritique(criticite: string | null | undefined): boolean {
  return criticite === 'CRITIQUE' || criticite === 'IMPORTANTE'
}

export type ErreurDecision = 'demande_close' | 'auto_validation_interdite' | 'droits_insuffisants' | 'annulation_reservee_au_demandeur' | 'motif_requis'
/**
 * Contrôle d'une décision : le demandeur ne décide jamais de sa propre demande (il peut seulement l'annuler) ; approuver ou
 * rejeter exige le droit de l'action (`autorise`, évalué par l'appelant dans l'organisation de la demande) ; rejet motivé.
 */
export function controlerDecision(d: { statut: string; demandeurId: string; valideurId: string; decision: DecisionDemande; autorise: boolean; motif?: string | null }): ErreurDecision | null {
  if (d.statut !== 'EN_ATTENTE') return 'demande_close'
  const estDemandeur = d.demandeurId === d.valideurId
  if (d.decision === 'ANNULER') return estDemandeur ? null : 'annulation_reservee_au_demandeur'
  if (estDemandeur) return 'auto_validation_interdite'
  if (!d.autorise) return 'droits_insuffisants'
  if (d.decision === 'REJETER' && !d.motif?.trim()) return 'motif_requis'
  return null
}

/**
 * Création d'un risque du registre directement au statut ACCEPTE alors qu'il est hors appétit (option active) : il est
 * enregistré au statut EVALUE (cotation faite, décision en attente) et une demande de double validation est ouverte.
 */
export function statutCreationRegistre<T extends { statut: string; graviteResiduelle?: number | null; vraisemblanceResiduelle?: number | null; taxonomieCode?: string | null }>(
  item: T, doubleValidationActive: boolean, appetit: AppetitConfig,
): { item: T; demander: boolean } {
  if (!doubleValidationActive || item.statut !== 'ACCEPTE') return { item, demander: false }
  if (!risqueRegistreHorsAppetit({ graviteResiduelle: item.graviteResiduelle ?? null, vraisemblanceResiduelle: item.vraisemblanceResiduelle ?? null, taxonomieCode: item.taxonomieCode ?? null }, appetit)) return { item, demander: false }
  return { item: { ...item, statut: 'EVALUE' }, demander: true }
}
