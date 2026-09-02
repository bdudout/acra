// ─── Catalogues de contrôles par défaut ──────────────────────────────────────
// Socles de contrôles-types prêts à l'emploi, importables en 1 clic dans la
// bibliothèque de contrôle permanent. Chaque modèle est rattaché à un référentiel
// et à ses exigences RÉELLES (refs builtin : ISO 27001:2022 « 5.x/8.x »,
// DORA « DORA-XXX-n ») → la conformité dérivée se câble automatiquement.
// Données PURES (aucune dépendance DB) → testables.

import type { Periodicite, ControleNiveau } from './controle'

export interface ControleTemplate {
  intitule: string
  description: string
  niveau: ControleNiveau
  periodicite: Periodicite
  referentielCode: string
  exigenceRefs: string[]
  checklist: string[]
}

export interface CatalogueControle {
  id: string          // identifiant stable du socle
  nom: string         // libellé affiché
  referentielCode: string
  controles: ControleTemplate[]
}

// ── Socle ISO/IEC 27001:2022 (Annexe A) ──────────────────────────────────────
const ISO27001: CatalogueControle = {
  id: 'ISO27001', nom: 'ISO/IEC 27001:2022 — socle', referentielCode: 'ISO27001',
  controles: [
    { intitule: 'Revue annuelle des politiques de sécurité (PSSI)', description: 'Vérifier que la PSSI est approuvée par la direction, datée de moins de 12 mois et diffusée.', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'ISO27001', exigenceRefs: ['5.1'], checklist: ['PSSI approuvée par la direction', 'Version datée de moins de 12 mois', 'Diffusée et accessible aux personnels'] },
    { intitule: 'Revue des droits d\'accès et comptes à privilèges', description: 'Contrôler la revue périodique des habilitations, la désactivation des comptes inactifs et le MFA sur les accès sensibles.', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'ISO27001', exigenceRefs: ['5.15', '5.18', '8.2'], checklist: ['Comptes des départs désactivés', 'Revue des droits formalisée', 'MFA actif sur les accès à privilèges', 'Aucun compte générique non justifié'] },
    { intitule: 'Séparation des tâches sensibles', description: 'Vérifier l\'absence de cumul de fonctions incompatibles (demande/validation, dev/prod).', niveau: 'N2', periodicite: 'SEMESTRIEL', referentielCode: 'ISO27001', exigenceRefs: ['5.3'], checklist: ['Matrice de séparation des tâches à jour', 'Aucun cumul de fonctions incompatibles constaté'] },
    { intitule: 'Inventaire des actifs à jour', description: 'Contrôler l\'exhaustivité et la fraîcheur de l\'inventaire des actifs et de leurs propriétaires.', niveau: 'N1', periodicite: 'SEMESTRIEL', referentielCode: 'ISO27001', exigenceRefs: ['5.9'], checklist: ['Inventaire exhaustif', 'Propriétaire défini par actif', 'Classification renseignée'] },
    { intitule: 'Sensibilisation et formation à la sécurité', description: 'Vérifier la réalisation des actions de sensibilisation et leur taux de couverture.', niveau: 'N1', periodicite: 'ANNUEL', referentielCode: 'ISO27001', exigenceRefs: ['6.3'], checklist: ['Campagne réalisée sur la période', 'Taux de participation suivi', 'Nouveaux arrivants formés'] },
    { intitule: 'Journalisation et surveillance des événements', description: 'Contrôler la collecte, la conservation et la revue des journaux de sécurité.', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'ISO27001', exigenceRefs: ['8.15', '8.16'], checklist: ['Journaux collectés sur les systèmes critiques', 'Durée de conservation respectée', 'Alertes revues et tracées'] },
    { intitule: 'Sauvegardes et test de restauration', description: 'Vérifier la réalisation des sauvegardes et l\'efficacité d\'un test de restauration.', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'ISO27001', exigenceRefs: ['8.13'], checklist: ['Sauvegardes réalisées selon la politique', 'Test de restauration concluant', 'Copie isolée / hors-ligne disponible'] },
    { intitule: 'Gestion des vulnérabilités et correctifs', description: 'Contrôler l\'application des correctifs et le traitement des vulnérabilités critiques dans les délais.', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'ISO27001', exigenceRefs: ['8.8'], checklist: ['Scan de vulnérabilités réalisé', 'Correctifs critiques appliqués dans les délais', 'Vulnérabilités résiduelles suivies'] },
    { intitule: 'Protection contre les codes malveillants', description: 'Vérifier la couverture et la mise à jour des protections anti-malware.', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'ISO27001', exigenceRefs: ['8.7'], checklist: ['Protection déployée sur le parc', 'Signatures/moteur à jour', 'Détections traitées'] },
    { intitule: 'Gestion des incidents de sécurité', description: 'Contrôler le traitement, la qualification et le retour d\'expérience des incidents.', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'ISO27001', exigenceRefs: ['5.24', '5.25', '5.26'], checklist: ['Incidents enregistrés et qualifiés', 'Délais de traitement respectés', 'Retour d\'expérience formalisé'] },
    { intitule: 'Sécurité des relations fournisseurs', description: 'Vérifier l\'évaluation sécurité des fournisseurs et les clauses contractuelles.', niveau: 'N2', periodicite: 'SEMESTRIEL', referentielCode: 'ISO27001', exigenceRefs: ['5.19', '5.20', '5.21', '5.22'], checklist: ['Fournisseurs critiques évalués', 'Clauses de sécurité contractuelles présentes', 'Suivi des niveaux de service'] },
    { intitule: 'Continuité d\'activité et tests', description: 'Contrôler l\'existence des plans de continuité et la réalisation d\'un test.', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'ISO27001', exigenceRefs: ['5.29', '5.30'], checklist: ['Plans de continuité à jour', 'Test de continuité réalisé', 'Écarts traités'] },
  ],
}

// ── Socle DORA (UE 2022/2554) ────────────────────────────────────────────────
const DORA: CatalogueControle = {
  id: 'DORA', nom: 'DORA (UE 2022/2554) — socle', referentielCode: 'DORA',
  controles: [
    { intitule: 'Revue du cadre de gestion du risque ICT', description: 'Vérifier l\'approbation et la revue annuelle du cadre de gestion du risque ICT par l\'organe de direction (art. 5).', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'DORA', exigenceRefs: ['DORA-ICT-1'], checklist: ['Cadre documenté et approuvé', 'Revue par l\'organe de direction < 12 mois', 'Responsabilités définies'] },
    { intitule: 'Cartographie des fonctions critiques et actifs ICT', description: 'Contrôler l\'identification et la mise à jour des fonctions critiques, actifs ICT et interdépendances (art. 8).', niveau: 'N1', periodicite: 'SEMESTRIEL', referentielCode: 'DORA', exigenceRefs: ['DORA-ICT-2'], checklist: ['Fonctions critiques identifiées', 'Actifs ICT rattachés', 'Interdépendances tenues à jour'] },
    { intitule: 'Sécurité ICT : accès, chiffrement, segmentation', description: 'Vérifier les mesures de protection et de prévention des moyens ICT (art. 9).', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'DORA', exigenceRefs: ['DORA-ICT-3'], checklist: ['Gestion des accès appliquée', 'Chiffrement des données sensibles', 'Segmentation réseau en place'] },
    { intitule: 'Détection des activités anormales', description: 'Contrôler les mécanismes de détection des anomalies et incidents ICT (art. 10).', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'DORA', exigenceRefs: ['DORA-ICT-4'], checklist: ['Détection déployée sur les systèmes critiques', 'Seuils et alertes définis', 'Alertes traitées'] },
    { intitule: 'Continuité ICT et objectifs RTO/RPO', description: 'Vérifier la politique de continuité ICT et les plans de rétablissement (art. 11).', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'DORA', exigenceRefs: ['DORA-ICT-5'], checklist: ['Politique de continuité ICT établie', 'RTO/RPO définis', 'Plans de rétablissement testés'] },
    { intitule: 'Sauvegardes et restauration éprouvées', description: 'Contrôler la réalisation et le test des sauvegardes sur environnement isolé (art. 12).', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'DORA', exigenceRefs: ['DORA-ICT-6'], checklist: ['Sauvegardes réalisées', 'Restauration testée', 'Environnement de test isolé'] },
    { intitule: 'Processus de gestion des incidents ICT', description: 'Vérifier le processus de détection, gestion et journalisation des incidents ICT (art. 17).', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'DORA', exigenceRefs: ['DORA-INC-1'], checklist: ['Processus formalisé', 'Rôles et escalade définis', 'Journalisation des incidents'] },
    { intitule: 'Classification et notification des incidents majeurs', description: 'Contrôler la classification DORA et la notification des incidents majeurs dans les délais (art. 18-19).', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'DORA', exigenceRefs: ['DORA-INC-2', 'DORA-INC-3'], checklist: ['Critères de classification appliqués', 'Notifications initiale/intermédiaire/finale dans les délais', 'Autorité compétente informée'] },
    { intitule: 'Programme de tests de résilience opérationnelle', description: 'Vérifier la réalisation du programme de tests (vulnérabilités, intrusion, continuité) (art. 24-25).', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'DORA', exigenceRefs: ['DORA-TEST-1'], checklist: ['Programme de tests défini', 'Tests réalisés sur les systèmes critiques', 'Remédiations suivies'] },
    { intitule: 'Registre des prestataires tiers ICT', description: 'Contrôler la tenue à jour du registre d\'information des accords ICT (art. 28).', niveau: 'N2', periodicite: 'SEMESTRIEL', referentielCode: 'DORA', exigenceRefs: ['DORA-TPP-1', 'DORA-TPP-2'], checklist: ['Registre exhaustif des contrats ICT', 'Prestataires critiques identifiés', 'Évaluation de risque avant contractualisation'] },
  ],
}

// ── Socle LCB-FT (CMF art. L.561-1 s.) — non-cyber ───────────────────────────
const LCB_FT: CatalogueControle = {
  id: 'LCB_FT', nom: 'Dispositif LCB-FT — socle', referentielCode: 'LCB_FT',
  controles: [
    { intitule: 'Actualisation de la classification des risques BC-FT', description: 'Vérifier que la classification des risques (clientèle, produits, canaux, géographie) est à jour et approuvée.', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'LCB_FT', exigenceRefs: ['LCBFT-1'], checklist: ['Classification documentée', 'Revue < 12 mois', 'Validée par le responsable LCB-FT'] },
    { intitule: 'Contrôle des dossiers d\'entrée en relation (KYC)', description: 'Contrôler par sondage la complétude de l\'identification client et bénéficiaire effectif à l\'entrée en relation.', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'LCB_FT', exigenceRefs: ['LCBFT-2'], checklist: ['Identité vérifiée (pièces)', 'Bénéficiaire effectif identifié', 'Objet/nature de la relation renseignés'] },
    { intitule: 'Vigilance constante sur les opérations', description: 'Vérifier le traitement des alertes de suivi des opérations et l\'actualisation de la connaissance client.', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'LCB_FT', exigenceRefs: ['LCBFT-3'], checklist: ['Alertes traitées dans les délais', 'Dossiers KYC actualisés', 'Opérations atypiques justifiées'] },
    { intitule: 'Détection et suivi des PPE', description: 'Contrôler l\'identification des personnes politiquement exposées et l\'application des mesures de vigilance renforcée.', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'LCB_FT', exigenceRefs: ['LCBFT-4'], checklist: ['Screening PPE en place', 'Vigilance renforcée appliquée', 'Validation hiérarchique tracée'] },
    { intitule: 'Qualité et délais des déclarations de soupçon', description: 'Contrôler la détection, l\'analyse et la transmission à Tracfin des opérations suspectes.', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'LCB_FT', exigenceRefs: ['LCBFT-5'], checklist: ['Analyses formalisées', 'Déclarations transmises sans délai', 'Traçabilité des décisions de non-déclaration'] },
    { intitule: 'Conservation des documents LCB-FT', description: 'Vérifier la conservation des pièces d\'identification et documents d\'opérations pendant la durée légale.', niveau: 'N1', periodicite: 'ANNUEL', referentielCode: 'LCB_FT', exigenceRefs: ['LCBFT-6'], checklist: ['Durée de conservation respectée (5 ans)', 'Pièces accessibles et intègres'] },
    { intitule: 'Réalisation des formations LCB-FT', description: 'Contrôler la réalisation et la couverture des formations des personnels exposés.', niveau: 'N1', periodicite: 'ANNUEL', referentielCode: 'LCB_FT', exigenceRefs: ['LCBFT-7'], checklist: ['Formation réalisée sur la période', 'Taux de couverture suivi', 'Nouveaux arrivants formés'] },
  ],
}

// ── Socle gel des avoirs & sanctions (Règl. UE + DG Trésor) — non-cyber ───────
const SANCTIONS_GEL: CatalogueControle = {
  id: 'SANCTIONS_GEL', nom: 'Gel des avoirs & sanctions — socle', referentielCode: 'SANCTIONS_GEL',
  controles: [
    { intitule: 'Filtrage de la base clients contre les listes', description: 'Vérifier le rescreening de la base clients à chaque mise à jour des listes de sanctions (UE/ONU/OFAC).', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'SANCTIONS_GEL', exigenceRefs: ['GEL-1'], checklist: ['Listes à jour', 'Rescreening réalisé après mise à jour', 'Correspondances tracées'] },
    { intitule: 'Filtrage des transactions', description: 'Contrôler le filtrage des opérations (virements, correspondants) contre les mesures restrictives.', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'SANCTIONS_GEL', exigenceRefs: ['GEL-2'], checklist: ['Filtrage actif sur les flux', 'Paramétrage revu', 'Alertes journalisées'] },
    { intitule: 'Traitement des alertes de correspondance', description: 'Vérifier l\'analyse et la levée/qualification des correspondances dans des délais maîtrisés.', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'SANCTIONS_GEL', exigenceRefs: ['GEL-3'], checklist: ['Délais de traitement respectés', 'Analyses formalisées', 'Escalade des vrais positifs'] },
    { intitule: 'Mise en œuvre du gel sans délai', description: 'Contrôler la capacité à geler les fonds sans délai et à déclarer à la DG Trésor.', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'SANCTIONS_GEL', exigenceRefs: ['GEL-4', 'GEL-5'], checklist: ['Procédure de gel testée', 'Gel exécutable sans délai', 'Déclaration DG Trésor tracée'] },
  ],
}

// ── Socle octroi & suivi des crédits (EBA/GL/2020/06) — non-cyber ─────────────
const CREDIT_OCTROI: CatalogueControle = {
  id: 'CREDIT_OCTROI', nom: 'Octroi & suivi des crédits — socle', referentielCode: 'CREDIT_OCTROI',
  controles: [
    { intitule: 'Analyse de la capacité de remboursement', description: 'Contrôler par sondage la réalisation et la qualité de l\'analyse de solvabilité au dossier.', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'CREDIT_OCTROI', exigenceRefs: ['CRED-1'], checklist: ['Analyse de solvabilité présente', 'Revenus/charges vérifiés', 'Taux d\'endettement calculé'] },
    { intitule: 'Respect des délégations d\'octroi', description: 'Vérifier que les décisions d\'octroi respectent les schémas de délégation et les limites.', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'CREDIT_OCTROI', exigenceRefs: ['CRED-2'], checklist: ['Décision dans la limite de délégation', 'Dépassements escaladés', 'Traçabilité de la décision'] },
    { intitule: 'Complétude du dossier et des garanties', description: 'Contrôler la complétude du dossier de crédit et la formalisation des garanties.', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'CREDIT_OCTROI', exigenceRefs: ['CRED-3'], checklist: ['Pièces obligatoires présentes', 'Garanties évaluées et formalisées', 'Assurances vérifiées'] },
    { intitule: 'Passage en comité des engagements', description: 'Vérifier le passage en comité des dossiers au-delà des seuils définis.', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'CREDIT_OCTROI', exigenceRefs: ['CRED-4'], checklist: ['Seuils de passage respectés', 'Comptes rendus de comité', 'Avis motivés tracés'] },
    { intitule: 'Revue des encours et détection des impayés', description: 'Contrôler la revue périodique des encours et la détection précoce des impayés.', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'CREDIT_OCTROI', exigenceRefs: ['CRED-5'], checklist: ['Revue des encours réalisée', 'Impayés détectés et suivis', 'Provisions ajustées'] },
  ],
}

// ── Socle RGPD (UE 2016/679) — non-cyber ─────────────────────────────────────
const RGPD: CatalogueControle = {
  id: 'RGPD', nom: 'RGPD — socle', referentielCode: 'RGPD',
  controles: [
    { intitule: 'Tenue du registre des traitements', description: 'Vérifier l\'exhaustivité et l\'actualisation du registre des activités de traitement (art. 30).', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'RGPD', exigenceRefs: ['RGPD-30'], checklist: ['Registre exhaustif', 'Finalités et durées renseignées', 'Revue < 12 mois'] },
    { intitule: 'Traitement des demandes d\'exercice des droits', description: 'Contrôler le traitement des demandes (accès, effacement, opposition) dans les délais (art. 15-22).', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'RGPD', exigenceRefs: ['RGPD-15'], checklist: ['Demandes tracées', 'Délai d\'un mois respecté', 'Réponses formalisées'] },
    { intitule: 'Gestion des violations de données', description: 'Vérifier la détection, la qualification et la notification des violations (art. 33-34).', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'RGPD', exigenceRefs: ['RGPD-33'], checklist: ['Registre des violations tenu', 'Notification CNIL < 72 h', 'Information des personnes si requise'] },
    { intitule: 'Encadrement des sous-traitants', description: 'Contrôler la présence de clauses et garanties suffisantes pour les sous-traitants (art. 28).', niveau: 'N2', periodicite: 'SEMESTRIEL', referentielCode: 'RGPD', exigenceRefs: ['RGPD-28'], checklist: ['Contrats art. 28 en place', 'Garanties évaluées', 'Sous-traitants ultérieurs encadrés'] },
    { intitule: 'Réalisation des analyses d\'impact (AIPD)', description: 'Vérifier la réalisation d\'une AIPD pour les traitements à risque élevé (art. 35).', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'RGPD', exigenceRefs: ['RGPD-35'], checklist: ['Traitements à risque identifiés', 'AIPD réalisées', 'Mesures d\'atténuation suivies'] },
  ],
}

// ── Socle MiFID II / MIF 2 (Dir. UE 2014/65) — protection clientèle ───────────
const MIF2: CatalogueControle = {
  id: 'MIF2', nom: 'MiFID II (MIF 2) — socle', referentielCode: 'MIF2',
  controles: [
    { intitule: 'Respect du marché cible (gouvernance produit)', description: 'Contrôler que les instruments distribués respectent le marché cible défini.', niveau: 'N2', periodicite: 'SEMESTRIEL', referentielCode: 'MIF2', exigenceRefs: ['MIF2-1'], checklist: ['Marché cible défini par produit', 'Distribution cohérente avec le marché cible', 'Écarts remontés'] },
    { intitule: 'Tests d\'adéquation et caractère approprié', description: 'Vérifier par sondage la réalisation et la traçabilité des tests selon le service fourni.', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'MIF2', exigenceRefs: ['MIF2-2'], checklist: ['Questionnaire client renseigné', 'Adéquation documentée', 'Alertes d\'inadéquation traitées'] },
    { intitule: 'Information sur les coûts et charges', description: 'Contrôler la communication précontractuelle des coûts et charges au client.', niveau: 'N1', periodicite: 'SEMESTRIEL', referentielCode: 'MIF2', exigenceRefs: ['MIF2-3'], checklist: ['Information ex ante remise', 'Récapitulatif ex post produit', 'Coûts agrégés présentés'] },
    { intitule: 'Contrôle de la meilleure exécution', description: 'Vérifier l\'application de la politique de meilleure exécution et le contrôle des ordres.', niveau: 'N2', periodicite: 'SEMESTRIEL', referentielCode: 'MIF2', exigenceRefs: ['MIF2-4'], checklist: ['Politique d\'exécution à jour', 'Qualité d\'exécution suivie', 'Réclamations traitées'] },
    { intitule: 'Encadrement des incitations (inducements)', description: 'Contrôler la conformité des rémunérations et avantages reçus/versés à des tiers.', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'MIF2', exigenceRefs: ['MIF2-5'], checklist: ['Inventaire des incitations', 'Amélioration du service démontrée', 'Information du client'] },
  ],
}

// ── Socle IDD / DDA (Dir. UE 2016/97) — distribution d'assurance ──────────────
const IDD: CatalogueControle = {
  id: 'IDD', nom: 'Distribution d\'assurance (IDD) — socle', referentielCode: 'IDD',
  controles: [
    { intitule: 'Recueil des exigences et besoins', description: 'Contrôler par sondage que les exigences et besoins du client sont recueillis avant proposition.', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'IDD', exigenceRefs: ['IDD-1'], checklist: ['Besoins recueillis et tracés', 'Proposition cohérente avec les besoins'] },
    { intitule: 'Remise du document d\'information (IPID)', description: 'Vérifier la remise du document d\'information normalisé produit.', niveau: 'N1', periodicite: 'SEMESTRIEL', referentielCode: 'IDD', exigenceRefs: ['IDD-2'], checklist: ['IPID remis avant souscription', 'Version à jour du produit'] },
    { intitule: 'Formalisation du devoir de conseil', description: 'Contrôler la formalisation et la cohérence du conseil délivré.', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'IDD', exigenceRefs: ['IDD-3'], checklist: ['Conseil écrit et motivé', 'Cohérence avec les besoins', 'Traçabilité conservée'] },
    { intitule: 'Surveillance produit (POG)', description: 'Vérifier le dispositif de gouvernance et surveillance des produits (marché cible).', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'IDD', exigenceRefs: ['IDD-4'], checklist: ['Marché cible défini', 'Revue produit réalisée', 'Distributeurs informés'] },
    { intitule: 'Formation continue des distributeurs', description: 'Contrôler la réalisation de la formation continue (15 h/an).', niveau: 'N1', periodicite: 'ANNUEL', referentielCode: 'IDD', exigenceRefs: ['IDD-5'], checklist: ['15 h de formation par an', 'Justificatifs conservés', 'Couverture des distributeurs suivie'] },
  ],
}

// ── Socle GAFI (40 recommandations) — LCB-FT international ─────────────────────
const GAFI: CatalogueControle = {
  id: 'GAFI', nom: 'Recommandations GAFI — socle', referentielCode: 'GAFI',
  controles: [
    { intitule: 'Évaluation des risques BC-FT (approche par les risques)', description: 'Contrôler l\'existence et l\'actualisation de l\'évaluation des risques (Rec. 1).', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'GAFI', exigenceRefs: ['GAFI-1'], checklist: ['Évaluation documentée', 'Mesures d\'atténuation définies', 'Revue périodique'] },
    { intitule: 'Devoir de vigilance clientèle (CDD)', description: 'Vérifier par sondage la mise en œuvre des mesures de vigilance (Rec. 10).', niveau: 'N1', periodicite: 'MENSUEL', referentielCode: 'GAFI', exigenceRefs: ['GAFI-10'], checklist: ['Identité et BE vérifiés', 'Objet de la relation compris', 'Vigilance adaptée au risque'] },
    { intitule: 'Mesures spécifiques aux PPE', description: 'Contrôler l\'application des mesures renforcées aux personnes politiquement exposées (Rec. 12).', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'GAFI', exigenceRefs: ['GAFI-12'], checklist: ['Détection des PPE', 'Approbation hiérarchique', 'Origine des fonds examinée'] },
    { intitule: 'Traçabilité des virements électroniques', description: 'Vérifier la présence des informations donneur d\'ordre / bénéficiaire (Rec. 16).', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'GAFI', exigenceRefs: ['GAFI-16'], checklist: ['Informations complètes sur les virements', 'Virements incomplets traités'] },
    { intitule: 'Déclaration des opérations suspectes', description: 'Contrôler le dispositif de déclaration des opérations suspectes (Rec. 20).', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'GAFI', exigenceRefs: ['GAFI-20'], checklist: ['Déclarations réalisées sans délai', 'Analyses tracées', 'Confidentialité respectée'] },
  ],
}

// ── Socle abus de marché (MAR, Règl. UE 596/2014) — déontologie ───────────────
const MAR: CatalogueControle = {
  id: 'MAR', nom: 'Abus de marché (MAR) — socle', referentielCode: 'MAR',
  controles: [
    { intitule: 'Détection et déclaration des opérations suspectes (STOR)', description: 'Contrôler le dispositif de détection et de déclaration des opérations suspectes.', niveau: 'N2', periodicite: 'TRIMESTRIEL', referentielCode: 'MAR', exigenceRefs: ['MAR-1'], checklist: ['Surveillance des ordres/transactions', 'STOR transmises à l\'AMF', 'Alertes tracées'] },
    { intitule: 'Tenue des listes d\'initiés', description: 'Vérifier l\'exhaustivité et la mise à jour des listes d\'initiés.', niveau: 'N1', periodicite: 'SEMESTRIEL', referentielCode: 'MAR', exigenceRefs: ['MAR-2'], checklist: ['Listes à jour', 'Initiés informés de leurs obligations', 'Horodatage conservé'] },
    { intitule: 'Transactions des dirigeants', description: 'Contrôler les déclarations et le respect des fenêtres négatives.', niveau: 'N2', periodicite: 'SEMESTRIEL', referentielCode: 'MAR', exigenceRefs: ['MAR-3'], checklist: ['Déclarations dans les délais', 'Fenêtres négatives respectées', 'Registre tenu'] },
    { intitule: 'Barrières à l\'information (murailles de Chine)', description: 'Vérifier l\'efficacité des dispositifs de séparation de l\'information privilégiée.', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'MAR', exigenceRefs: ['MAR-4'], checklist: ['Cloisonnement en place', 'Franchissements contrôlés', 'Watch/restricted lists tenues'] },
  ],
}

// ── Socle Solvabilité II (Dir. UE 2009/138) — gouvernance assurance ───────────
const SOLVA2: CatalogueControle = {
  id: 'SOLVA2', nom: 'Solvabilité II — socle', referentielCode: 'SOLVA2',
  controles: [
    { intitule: 'Fonctionnement des fonctions clés', description: 'Contrôler l\'existence et l\'indépendance des 4 fonctions clés (actuariat, conformité, audit interne, gestion des risques).', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'SOLVA2', exigenceRefs: ['SOLVA2-1'], checklist: ['Fonctions clés désignées', 'Rapports produits', 'Indépendance respectée'] },
    { intitule: 'Réalisation de l\'ORSA', description: 'Vérifier la réalisation et l\'utilisation de l\'évaluation interne des risques et de la solvabilité.', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'SOLVA2', exigenceRefs: ['SOLVA2-2'], checklist: ['ORSA réalisée', 'Approuvée par l\'organe d\'administration', 'Intégrée aux décisions'] },
    { intitule: 'Suivi des exigences de capital (SCR/MCR)', description: 'Contrôler le calcul et le suivi du SCR et du MCR.', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'SOLVA2', exigenceRefs: ['SOLVA2-3'], checklist: ['SCR/MCR calculés', 'Couverture suivie', 'Dépassements escaladés'] },
    { intitule: 'Encadrement de la sous-traitance critique', description: 'Vérifier l\'encadrement des activités importantes ou critiques externalisées.', niveau: 'N2', periodicite: 'ANNUEL', referentielCode: 'SOLVA2', exigenceRefs: ['SOLVA2-4'], checklist: ['Notification ACPR le cas échéant', 'Clauses contractuelles', 'Suivi des prestataires'] },
    { intitule: 'Production du reporting prudentiel', description: 'Contrôler la production dans les délais des états réglementaires (QRT, RSR, SFCR).', niveau: 'N1', periodicite: 'TRIMESTRIEL', referentielCode: 'SOLVA2', exigenceRefs: ['SOLVA2-5'], checklist: ['QRT produits dans les délais', 'SFCR/RSR publiés', 'Contrôles de cohérence réalisés'] },
  ],
}

export const CATALOGUES_CONTROLES: CatalogueControle[] = [
  ISO27001, DORA, LCB_FT, SANCTIONS_GEL, CREDIT_OCTROI, RGPD,
  MIF2, IDD, GAFI, MAR, SOLVA2,
]

/** Retourne un socle par son identifiant, ou undefined. */
export function getCatalogueControle(id: string): CatalogueControle | undefined {
  return CATALOGUES_CONTROLES.find(c => c.id === id)
}
