// ─── Politique de sécurité par défaut (socle DORA + ISO/IEC 27001/27002) ─────
// Fournie « prête à l'emploi » quand l'organisation n'a encore ni stratégie ni
// politique. Elle porte des MISSIONS (objectifs de sécurité — protéger le DIC des
// données et des services clients, résilience DORA…) et des EXIGENCES (points de
// contrôle) alignées sur les 5 piliers DORA et les 4 thèmes ISO/IEC 27002:2022.
// L'organisation la clone puis l'adapte. Données PURES (aucune dépendance).

import type { ReferentielInput, Mission, Exigence } from './referentiel'

export const POLITIQUE_DEFAUT_CODE = 'PSSI-SOCLE'

// Objectifs stratégiques de sécurité (« missions »).
export const MISSIONS_DEFAUT: Mission[] = [
  { intitule: 'Protéger la disponibilité, l\'intégrité et la confidentialité (DIC) des données et des services rendus aux clients', description: 'Objectif premier : préserver le DIC des informations et la continuité des services fournis aux clients et parties prenantes.' },
  { intitule: 'Assurer la résilience opérationnelle numérique', description: 'Maintenir les fonctions critiques ou importantes malgré les incidents et perturbations (DORA, chapitre II).' },
  { intitule: 'Maîtriser les risques liés aux prestataires TIC', description: 'Encadrer, surveiller et documenter la dépendance aux tiers TIC, notamment critiques (DORA, chapitre V).' },
  { intitule: 'Détecter, gérer et notifier les incidents TIC dans les délais réglementaires', description: 'Traiter les incidents et respecter les obligations de notification (DORA art. 19, NIS2).' },
  { intitule: 'Tester régulièrement la résilience', description: 'Éprouver les dispositifs (tests de continuité PCA/PRA, tests de résilience opérationnelle numérique).' },
  { intitule: 'Gouverner la sécurité et rendre compte à la direction', description: 'Rôles et responsabilités clairs, revue périodique par l\'organe de direction, appétit au risque défini.' },
  { intitule: 'Développer une culture de sécurité', description: 'Sensibiliser et responsabiliser l\'ensemble du personnel et des tiers.' },
  { intitule: 'Assurer la conformité réglementaire', description: 'Respecter DORA, NIS2, le RGPD et les référentiels applicables (ISO/IEC 27001).' },
]

// Points de contrôle du socle : piliers DORA + thèmes ISO/IEC 27002:2022.
export const EXIGENCES_DEFAUT: Exigence[] = [
  { ref: 'POL-01', nom: 'Gouvernance et politique de sécurité', description: 'Politique approuvée par la direction, revue au moins annuellement.', categorie: 'Gouvernance', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-02', nom: 'Rôles et responsabilités de sécurité', description: 'RSSI, propriétaires de risques, 3 lignes de défense définies.', categorie: 'Gouvernance', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-03', nom: 'Cadre de gestion des risques TIC', description: 'Identification, évaluation et traitement des risques TIC (DORA pilier 1).', categorie: 'Gestion des risques TIC (DORA 1)', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-04', nom: 'Classification et protection de l\'information', description: 'Inventaire des actifs, classification selon le DIC.', categorie: 'Protection de l\'information', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-05', nom: 'Gestion des identités et des accès', description: 'Moindre privilège, authentification forte, revue des accès.', categorie: 'Contrôle d\'accès', type: 'TECHNOLOGIQUE' },
  { ref: 'POL-06', nom: 'Chiffrement et protection des données', description: 'Chiffrement au repos et en transit, gestion des clés.', categorie: 'Protection de l\'information', type: 'TECHNOLOGIQUE' },
  { ref: 'POL-07', nom: 'Sécurité du développement et des changements', description: 'Développement sécurisé, gestion des changements, séparation des environnements.', categorie: 'Sécurité applicative', type: 'TECHNOLOGIQUE' },
  { ref: 'POL-08', nom: 'Journalisation et supervision', description: 'Collecte, protection et analyse des journaux ; détection des événements.', categorie: 'Détection', type: 'TECHNOLOGIQUE' },
  { ref: 'POL-09', nom: 'Gestion des vulnérabilités et correctifs', description: 'Détection, priorisation et remédiation des vulnérabilités.', categorie: 'Sécurité technique', type: 'TECHNOLOGIQUE' },
  { ref: 'POL-10', nom: 'Sauvegardes et restauration', description: 'Sauvegardes régulières, testées et isolées.', categorie: 'Résilience (DORA 3)', type: 'TECHNOLOGIQUE' },
  { ref: 'POL-11', nom: 'Continuité d\'activité (PCA/PRA)', description: 'Plans de continuité et de reprise des fonctions critiques (DORA pilier 3).', categorie: 'Résilience (DORA 3)', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-12', nom: 'Gestion des incidents de sécurité', description: 'Processus de détection, classification et traitement des incidents (DORA pilier 2).', categorie: 'Incidents (DORA 2)', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-13', nom: 'Notification réglementaire des incidents', description: 'Notification des incidents majeurs dans les délais (DORA art. 19, NIS2).', categorie: 'Incidents (DORA 2)', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-14', nom: 'Tests de résilience opérationnelle numérique', description: 'Programme de tests, y compris avancés (TLPT) pour les entités concernées.', categorie: 'Résilience (DORA 3)', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-15', nom: 'Gestion des risques liés aux tiers TIC', description: 'Évaluation, contractualisation et surveillance des prestataires TIC (DORA pilier 4).', categorie: 'Tiers TIC (DORA 4)', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-16', nom: 'Registre d\'information des tiers TIC', description: 'Tenue du registre des accords contractuels (DORA art. 28).', categorie: 'Tiers TIC (DORA 4)', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-17', nom: 'Sécurité des ressources humaines', description: 'Vérifications, clauses contractuelles, gestion des départs.', categorie: 'Ressources humaines', type: 'HUMAINE' },
  { ref: 'POL-18', nom: 'Sensibilisation et formation', description: 'Programme de sensibilisation régulier pour le personnel et les tiers.', categorie: 'Ressources humaines', type: 'HUMAINE' },
  { ref: 'POL-19', nom: 'Sécurité physique et environnementale', description: 'Protection des locaux, des équipements et des supports.', categorie: 'Sécurité physique', type: 'PHYSIQUE' },
  { ref: 'POL-20', nom: 'Partage d\'information sur les cybermenaces', description: 'Participation aux dispositifs d\'échange sur les menaces (DORA pilier 5).', categorie: 'Partage (DORA 5)', type: 'ORGANISATIONNELLE' },
  { ref: 'POL-21', nom: 'Conformité, contrôle et audit', description: 'Vérification de conformité, contrôle permanent et audit interne.', categorie: 'Conformité', type: 'ORGANISATIONNELLE' },
]

/** Construit l'entrée de référentiel de la politique de sécurité par défaut. */
export function buildPolitiqueDefaut(): ReferentielInput {
  return {
    code: POLITIQUE_DEFAUT_CODE,
    nom: 'Politique de sécurité des systèmes d\'information (socle)',
    type: 'PSSI',
    version: '1.0',
    description: 'Politique de sécurité par défaut, alignée sur DORA (résilience opérationnelle numérique) et ISO/IEC 27001/27002. À adopter puis adapter au contexte de l\'organisation.',
    missions: MISSIONS_DEFAUT,
    exigences: EXIGENCES_DEFAUT,
  }
}
