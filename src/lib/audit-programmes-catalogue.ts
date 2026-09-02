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

const LCB_FT: ProgrammeAuditType = {
  id: 'LCB_FT', nom: 'Dispositif LCB-FT — programme type',
  points: [
    'Classification des risques BC-FT documentée, actualisée et approuvée',
    'Procédures internes LCB-FT formalisées et à jour',
    'Identification client et bénéficiaire effectif à l\'entrée en relation (KYC)',
    'Mesures de vigilance adaptées au risque et vigilance constante sur les opérations',
    'Détection et traitement des personnes politiquement exposées (PPE)',
    'Détection, analyse et déclaration des soupçons à Tracfin (délais, traçabilité)',
    'Dispositif de gel et filtrage des mesures restrictives articulé avec la LCB-FT',
    'Conservation des documents pendant la durée réglementaire',
    'Formation et sensibilisation des personnels exposés',
    'Organisation : responsable LCB-FT, déclarant/correspondant Tracfin, moyens',
    'Contrôle interne du dispositif et suivi des recommandations',
  ],
}

const SANCTIONS_GEL: ProgrammeAuditType = {
  id: 'SANCTIONS_GEL', nom: 'Gel des avoirs & sanctions — programme type',
  points: [
    'Listes de sanctions (UE/ONU/OFAC) intégrées et mises à jour sans délai',
    'Filtrage de la base clients et rescreening après chaque mise à jour',
    'Filtrage des transactions et des correspondants bancaires',
    'Paramétrage de l\'outil de filtrage revu et documenté',
    'Traitement des alertes : délais, analyse et qualification des correspondances',
    'Procédure de gel des fonds exécutable sans délai (testée)',
    'Déclaration des mesures de gel à la Direction générale du Trésor',
    'Traçabilité des décisions et pistes d\'audit',
  ],
}

const CREDIT_OCTROI: ProgrammeAuditType = {
  id: 'CREDIT_OCTROI', nom: 'Octroi & suivi des crédits — programme type',
  points: [
    'Analyse de la capacité de remboursement au dossier (solvabilité)',
    'Respect des schémas de délégation et des limites d\'octroi',
    'Complétude du dossier de crédit et formalisation des garanties',
    'Passage en comité des engagements au-delà des seuils',
    'Dispositif de notation / cotation des contreparties',
    'Revue périodique des encours et détection précoce des impayés',
    'Provisionnement et classification des créances douteuses',
    'Suivi des dépassements et des exceptions à la politique de crédit',
  ],
}

const RGPD: ProgrammeAuditType = {
  id: 'RGPD', nom: 'RGPD — programme type',
  points: [
    'Registre des activités de traitement exhaustif et à jour (art. 30)',
    'Bases légales et recueil du consentement le cas échéant (art. 6-7)',
    'Information des personnes concernées (art. 13-14)',
    'Traitement des demandes d\'exercice des droits dans les délais (art. 15-22)',
    'Sécurité des traitements adaptée au risque (art. 32)',
    'Gestion et notification des violations de données (art. 33-34)',
    'Analyses d\'impact (AIPD) pour les traitements à risque élevé (art. 35)',
    'Encadrement contractuel des sous-traitants (art. 28)',
    'Désignation et positionnement du DPO le cas échéant',
  ],
}

const CONTROLE_INTERNE: ProgrammeAuditType = {
  id: 'CONTROLE_INTERNE', nom: 'Dispositif de contrôle interne — programme type',
  points: [
    'Contrôles permanents de 1er et 2e niveau formalisés et tracés',
    'Indépendance et moyens de la fonction de contrôle périodique (3e ligne)',
    'Rôles de l\'organe de surveillance et des dirigeants effectifs',
    'Cartographie des risques tenue à jour et alimentant le plan de contrôle',
    'Plan de contrôle pluriannuel et couverture des activités/risques',
    'Rapport annuel de contrôle interne et information de l\'organe de surveillance',
    'Suivi des recommandations et des plans d\'action',
    'Externalisation : registre, criticité et clauses de réversibilité',
  ],
}

const MIF2: ProgrammeAuditType = {
  id: 'MIF2', nom: 'MiFID II (MIF 2) — programme type',
  points: [
    'Gouvernance produit : marché cible défini et respecté',
    'Tests d\'adéquation et de caractère approprié documentés',
    'Information précontractuelle sur les coûts et charges',
    'Politique et contrôle de la meilleure exécution',
    'Encadrement des incitations (inducements)',
    'Enregistrement des communications et conservation',
    'Gestion des conflits d\'intérêts',
    'Traitement des réclamations clients',
  ],
}

const IDD: ProgrammeAuditType = {
  id: 'IDD', nom: 'Distribution d\'assurance (IDD) — programme type',
  points: [
    'Recueil des exigences et besoins avant proposition',
    'Remise du document d\'information normalisé (IPID)',
    'Devoir de conseil formalisé et cohérent',
    'Surveillance et gouvernance des produits (POG)',
    'Formation continue des distributeurs (15 h/an)',
    'Gestion des conflits d\'intérêts et transparence des rémunérations',
    'Traitement des réclamations',
  ],
}

const GAFI: ProgrammeAuditType = {
  id: 'GAFI', nom: 'Recommandations GAFI — programme type',
  points: [
    'Évaluation des risques BC-FT et approche fondée sur les risques (Rec. 1)',
    'Devoir de vigilance clientèle (CDD) (Rec. 10)',
    'Mesures renforcées pour les PPE (Rec. 12)',
    'Traçabilité des virements électroniques (Rec. 16)',
    'Déclaration des opérations suspectes (Rec. 20)',
    'Conservation des documents (Rec. 11)',
    'Contrôles internes et formation (Rec. 18)',
  ],
}

const MAR: ProgrammeAuditType = {
  id: 'MAR', nom: 'Abus de marché (MAR) — programme type',
  points: [
    'Détection et déclaration des opérations suspectes (STOR)',
    'Tenue et mise à jour des listes d\'initiés',
    'Déclarations des transactions des dirigeants et fenêtres négatives',
    'Barrières à l\'information (murailles de Chine)',
    'Gestion des informations privilégiées et sondages de marché',
    'Watch lists / restricted lists tenues à jour',
  ],
}

const SOLVA2: ProgrammeAuditType = {
  id: 'SOLVA2', nom: 'Solvabilité II — programme type',
  points: [
    'Système de gouvernance et fonctions clés (actuariat, conformité, audit, risques)',
    'Évaluation interne des risques et de la solvabilité (ORSA)',
    'Calcul et suivi des exigences de capital (SCR/MCR)',
    'Politique de gestion des risques et limites',
    'Encadrement de la sous-traitance des activités critiques',
    'Qualité des données et provisions techniques',
    'Reporting prudentiel (QRT, RSR, SFCR) dans les délais',
  ],
}

export const PROGRAMMES_AUDIT: ProgrammeAuditType[] = [
  ISO27001, DORA, LCB_FT, SANCTIONS_GEL, CREDIT_OCTROI, RGPD, CONTROLE_INTERNE,
  MIF2, IDD, GAFI, MAR, SOLVA2,
]

/** Retourne un programme type par identifiant, ou undefined. */
export function getProgrammeAudit(id: string): ProgrammeAuditType | undefined {
  return PROGRAMMES_AUDIT.find(p => p.id === id)
}
