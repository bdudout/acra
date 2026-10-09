// ─── Lien des e-mails de relance — PUR ────────────────────────────────────────
// Page ouverte par le lien de l'e-mail : celle de l'objet du premier élément listé quand elle est connue (ex. le projet
// à approuver), sinon la page de sa catégorie. Seul un chemin interne est accepté. Testé : relances-chemins.test.ts.
import type { RelanceItem } from '@/lib/email-i18n'

export const CHEMINS: Record<RelanceItem['categorie'], string> = {
  QUESTIONNAIRE: '/controles/questionnaires', PRECONISATION: '/controles/questionnaires', PRECONISATION_A_VERIFIER: '/controles/questionnaires',
  PLAN_ACTION: '/plans-actions', ANALYSE_A_APPROUVER: '/analyses', PROJET360_A_APPROUVER: '/projets',
  DEROGATION_AVIS: '/derogations', DEROGATION_DOUBLE_REGARD: '/derogations', DEROGATION_VALIDATION: '/derogations', DEROGATION_EXPIRATION: '/derogations', HOMOLOGATION_RENOUVELLEMENT: '/homologations',
  CONSTAT_AUDIT: '/audit', CONSTAT_A_VERIFIER: '/audit', CONTROLE_A_EXECUTER: '/controles',
  CONTRAT_TIC: '/registre-tic', TEST_RESILIENCE: '/reglementaire/tests-resilience', KRI_MESURE: '/kri', DOCUMENT_A_REVOIR: '/documents',
  CAMPAGNE_CONTROLE: '/controles/campagnes', MISSION_AUDIT: '/audit', ANALYSE_ECHEANCE: '/analyses', INVITATION: '/configuration/entites', ACCEPTATION_RISQUES: '/analyses', SUPPRESSION_RISQUE: '/projets', AIPD_A_REALISER: '/rgpd', PLAN_ANNUEL_A_VALIDER: '/plans', PROPOSITION_MCP: '/mcp-propositions',
  REVUE_SYSTEME_IA: '/registre-ia', REVUE_TRAITEMENT: '/rgpd', REVUE_PROCESSUS: '/processus', REVUE_TIERS: '/tiers',
}

export function cheminRelance(item: { categorie: RelanceItem['categorie']; chemin?: string }): string {
  return item.chemin && /^\/(?!\/)/.test(item.chemin) ? item.chemin : CHEMINS[item.categorie]
}
