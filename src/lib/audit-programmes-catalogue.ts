// ─── Catalogues de programmes d'audit types ──────────────────────────────────
// Programmes d'audit prêts à l'emploi (points de revue) chargeables dans une
// mission. Données PURES → testables. Alignés sur ISO/IEC 27001:2022 et DORA.

export interface ProgrammeAuditType {
  id: string
  nom: string
  points: string[]
}

const ISO27001: ProgrammeAuditType = {
  id: 'ISO27001', nom: 'ISO/IEC 27001:2022 — programme type',
  points: [
    'PSSI approuvée par la direction, datée de moins de 12 mois et diffusée',
    'Rôles et responsabilités de sécurité attribués et communiqués',
    'Analyse de risques à jour et plan de traitement suivi',
    'Revue périodique des droits d\'accès et des comptes à privilèges',
    'Gestion des vulnérabilités et des correctifs (délais respectés)',
    'Journalisation, surveillance et traitement des alertes de sécurité',
    'Sauvegardes réalisées et test de restauration concluant',
    'Gestion des incidents : enregistrement, qualification, retour d\'expérience',
    'Sécurité des fournisseurs : évaluation et clauses contractuelles',
    'Continuité d\'activité : plans à jour et test réalisé',
    'Sensibilisation et formation à la sécurité (couverture suivie)',
    'Traitement des non-conformités et actions correctives de l\'audit précédent',
  ],
}

const DORA: ProgrammeAuditType = {
  id: 'DORA', nom: 'DORA (UE 2022/2554) — programme type',
  points: [
    'Cadre de gestion du risque ICT approuvé et revu par l\'organe de direction (art. 5)',
    'Cartographie des fonctions critiques, actifs ICT et interdépendances (art. 8)',
    'Mesures de protection et de prévention ICT : accès, chiffrement, segmentation (art. 9)',
    'Dispositifs de détection des anomalies et incidents ICT (art. 10)',
    'Politique de continuité ICT, RTO/RPO et plans de rétablissement testés (art. 11-12)',
    'Processus de gestion et de classification des incidents ICT (art. 17-18)',
    'Notification des incidents majeurs dans les délais réglementaires (art. 19)',
    'Programme de tests de résilience opérationnelle numérique (art. 24-25)',
    'Tests de pénétration fondés sur la menace (TLPT) le cas échéant (art. 26-27)',
    'Registre d\'information des prestataires tiers ICT tenu à jour (art. 28)',
    'Clauses contractuelles obligatoires et stratégies de sortie des prestataires critiques (art. 30)',
    'Suivi des recommandations et lettres de suite du régulateur',
  ],
}

export const PROGRAMMES_AUDIT: ProgrammeAuditType[] = [ISO27001, DORA]

/** Retourne un programme type par identifiant, ou undefined. */
export function getProgrammeAudit(id: string): ProgrammeAuditType | undefined {
  return PROGRAMMES_AUDIT.find(p => p.id === id)
}
