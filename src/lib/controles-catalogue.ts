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

export const CATALOGUES_CONTROLES: CatalogueControle[] = [ISO27001, DORA]

/** Retourne un socle par son identifiant, ou undefined. */
export function getCatalogueControle(id: string): CatalogueControle | undefined {
  return CATALOGUES_CONTROLES.find(c => c.id === id)
}
