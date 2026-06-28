/**
 * exemples-sectoriels.ts — Packs d'exemples spécifiques par secteur d'activité.
 *
 * Contrairement à `exemples-context.ts` (qui réordonne le catalogue générique),
 * ce module APPORTE du contenu : des exemples réellement adaptés au métier
 * (santé, finance, industrie/OT, secteur public) injectés en tête des listes
 * d'ateliers quand le secteur de l'analyse correspond. 100 % données, aucune IA.
 *
 * Pour l'instant en FR (comme le catalogue de base `ebios-data.ts`) ; l'i18n des
 * autres langues suivra. Les shapes reprennent celles de `exemples-defaults.ts`.
 *
 * Module pur → testé unitairement (exemples-sectoriels.test.ts).
 */

import type { Locale } from '@/lib/i18n'
import en from '@/lib/i18n/exemples-sectoriels/en'
import de from '@/lib/i18n/exemples-sectoriels/de'
import es from '@/lib/i18n/exemples-sectoriels/es'
import it from '@/lib/i18n/exemples-sectoriels/it'

export type SectorExempleCategory =
  | 'valeursMetier'
  | 'biensSupports'
  | 'evenementsRedoutes'
  | 'sourcesRisque'
  | 'scenariosStrategiques'

// Dictionnaires de traduction (FR = source dans les données ci-dessous, donc absent).
// Clé : `${famille}.${categorie}.${index}.${champ}` (+ `.impacts.${j}` pour les tableaux).
const DICTS: Partial<Record<Locale, Record<string, string>>> = { en, de, es, it }
const TEXT_FIELDS = ['nom', 'description', 'motivation', 'ressources']

export interface SectorFamily {
  /** Sous-chaînes (minuscules) reconnues dans le libellé du secteur de l'analyse. */
  match: string[]
  /** Identifiant interne de la famille. */
  key: 'sante' | 'finance' | 'industrie' | 'public' | 'transport' | 'telecom' | 'education' | 'commerce' | 'juridique' | 'numerique'
  exemples: Partial<Record<SectorExempleCategory, Record<string, unknown>[]>>
}

// ─────────────────────────────────────────────────────────────────────────────
// SANTÉ — hôpital, EHPAD, médico-social
// ─────────────────────────────────────────────────────────────────────────────
const SANTE: SectorFamily = {
  key: 'sante',
  match: ['santé', 'sante', 'hôpital', 'hopital', 'health', 'soin', 'clinique', 'médico', 'medico', 'ehpad', 'médical', 'medical'],
  exemples: {
    valeursMetier: [
      { nom: 'Prise en charge des patients aux urgences', type: 'PROCESSUS', description: 'Accueil, tri, soins et orientation des patients en situation d’urgence', responsable: 'Direction des soins / service des urgences', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 3 },
      { nom: 'Dossier Patient Informatisé (DPI)', type: 'INFORMATION', description: 'Données de santé, antécédents, prescriptions et comptes rendus des patients', responsable: 'DSI / Direction des systèmes d’information', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Circuit du médicament', type: 'PROCESSUS', description: 'Prescription, dispensation et administration des traitements', responsable: 'Pharmacie à usage intérieur', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4 },
      { nom: 'Imagerie médicale (PACS)', type: 'INFORMATION', description: 'Images radiologiques et comptes rendus d’examens des patients', responsable: 'Service d’imagerie médicale', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3 },
    ],
    biensSupports: [
      { nom: 'Système d’information hospitalier (SIH / DPI)', type: 'LOGICIEL', description: 'Application centrale hébergeant les dossiers patients' },
      { nom: 'Serveur d’imagerie (PACS)', type: 'LOGICIEL', description: 'Stockage et diffusion des images médicales' },
      { nom: 'Dispositifs médicaux connectés', type: 'MATERIEL', description: 'Pompes, moniteurs, respirateurs et automates de biologie reliés au réseau' },
      { nom: 'Hébergeur de données de santé (HDS)', type: 'SOUS_TRAITANCE', description: 'Prestataire certifié HDS hébergeant les données de santé' },
    ],
    evenementsRedoutes: [
      { description: 'Indisponibilité du SIH bloquant la prise en charge des patients', impacts: ['Report de soins et d’interventions', 'Risque vital pour les patients', 'Bascule en mode dégradé papier'], graviteDefaut: 4 },
      { description: 'Fuite massive de dossiers patients (données de santé)', impacts: ['Atteinte à la vie privée des patients', 'Sanction CNIL (RGPD art. 9)', 'Perte de confiance'], graviteDefaut: 4 },
      { description: 'Altération de prescriptions ou de paramètres de dispositifs médicaux', impacts: ['Erreur de traitement', 'Risque vital pour les patients'], graviteDefaut: 4 },
    ],
    sourcesRisque: [
      { nom: 'Groupe de rançongiciel ciblant les hôpitaux', categorie: 'CYBERCRIMINEL', description: 'Cybercriminels exploitant la criticité vitale des soins pour maximiser la pression au paiement', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'D', nom: 'Arrêt du SIH par rançongiciel (D)', description: 'Un rançongiciel chiffre le SIH et bloque l’accès aux dossiers et aux plateaux techniques', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'C', nom: 'Exfiltration de données de santé (C)', description: 'Vol puis publication de dossiers patients par un cybercriminel', vraisemblanceDefaut: 3, graviteDefaut: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE — banque, assurance, fintech
// ─────────────────────────────────────────────────────────────────────────────
const FINANCE: SectorFamily = {
  key: 'finance',
  match: ['banque', 'bancaire', 'finance', 'financ', 'assur', 'fintech'],
  exemples: {
    valeursMetier: [
      { nom: 'Exécution des paiements et virements', type: 'PROCESSUS', description: 'Traitement des ordres de paiement, virements SEPA et SWIFT', responsable: 'Direction des opérations / back-office', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4 },
      { nom: 'Core banking (tenue des comptes)', type: 'INFORMATION', description: 'Soldes, opérations et référentiel clients du système central', responsable: 'DSI / Direction des systèmes d’information', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Octroi de crédit et scoring', type: 'PROCESSUS', description: 'Évaluation du risque et décision d’octroi de crédit', responsable: 'Direction des risques crédit', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Lutte anti-fraude et conformité (LCB-FT)', type: 'PROCESSUS', description: 'Détection de fraude, blanchiment et financement du terrorisme', responsable: 'Direction de la conformité (LCB-FT)', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
    ],
    biensSupports: [
      { nom: 'Plateforme core banking', type: 'LOGICIEL', description: 'Progiciel central de tenue des comptes et des opérations' },
      { nom: 'Passerelle SWIFT', type: 'RESEAU', description: 'Connexion au réseau interbancaire international de paiement' },
      { nom: 'Application de banque en ligne / mobile', type: 'LOGICIEL', description: 'Canaux digitaux d’accès des clients à leurs comptes' },
      { nom: 'Distributeurs automatiques (DAB / GAB)', type: 'MATERIEL', description: 'Terminaux de retrait et de dépôt en agence et hors site' },
    ],
    evenementsRedoutes: [
      { description: 'Détournement de virements ou fraude sur les paiements', impacts: ['Perte financière directe', 'Sanction réglementaire (DORA / ACPR)', 'Atteinte à la réputation'], graviteDefaut: 4 },
      { description: 'Indisponibilité de la banque en ligne et des paiements', impacts: ['Clients privés d’accès à leurs fonds', 'Sanction du régulateur', 'Perte de confiance'], graviteDefaut: 4 },
      { description: 'Fuite des données bancaires et personnelles des clients', impacts: ['Usurpation d’identité', 'Sanction RGPD', 'Préjudice client'], graviteDefaut: 4 },
    ],
    sourcesRisque: [
      { nom: 'Groupe spécialisé en fraude bancaire (type Carbanak)', categorie: 'CYBERCRIMINEL', description: 'Cybercriminels organisés ciblant les systèmes de paiement et SWIFT', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'I', nom: 'Manipulation frauduleuse des virements (I)', description: 'Un attaquant détourne des ordres de paiement via la passerelle SWIFT', vraisemblanceDefaut: 2, graviteDefaut: 4 },
      { critere: 'D', nom: 'Indisponibilité des services de paiement (D)', description: 'Attaque rendant indisponibles la banque en ligne et les paiements', vraisemblanceDefaut: 3, graviteDefaut: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRIE / ÉNERGIE — systèmes industriels (OT/ICS)
// ─────────────────────────────────────────────────────────────────────────────
const INDUSTRIE: SectorFamily = {
  key: 'industrie',
  match: ['industrie', 'industry', 'manufactur', 'usine', 'énergie', 'energie', 'energy', 'utilities', 'nucléaire', 'nucleaire', 'eau', 'production'],
  exemples: {
    valeursMetier: [
      { nom: 'Conduite de la production industrielle', type: 'PROCESSUS', description: 'Pilotage des lignes de production et des procédés via le système OT', responsable: 'Direction de la production', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 3 },
      { nom: 'Supervision et conduite du procédé (SCADA)', type: 'INFORMATION', description: 'Données temps réel de supervision et de commande des installations', responsable: 'Responsable OT / automatismes', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Sûreté de fonctionnement des installations', type: 'PROCESSUS', description: 'Systèmes instrumentés de sécurité protégeant personnes et environnement', responsable: 'Direction HSE / sûreté de fonctionnement', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Maintenance et télégestion', type: 'PROCESSUS', description: 'Télémaintenance et exploitation à distance des équipements industriels', responsable: 'Direction de la maintenance', disponibilite: 3, integrite: 4, confidentialite: 2, tracabilite: 4 },
    ],
    biensSupports: [
      { nom: 'Automates programmables (PLC)', type: 'MATERIEL', description: 'Contrôleurs pilotant les équipements de production' },
      { nom: 'Système SCADA / poste de supervision', type: 'LOGICIEL', description: 'Supervision et commande centralisée du procédé industriel' },
      { nom: 'Réseau OT / bus de terrain', type: 'RESEAU', description: 'Réseau industriel reliant capteurs, automates et supervision' },
      { nom: 'Accès de télémaintenance fournisseur', type: 'SOUS_TRAITANCE', description: 'Connexion distante d’un fournisseur pour la maintenance des équipements' },
    ],
    evenementsRedoutes: [
      { description: 'Arrêt ou sabotage de la production industrielle', impacts: ['Perte de production', 'Atteinte à la sécurité des personnes', 'Dommages matériels'], graviteDefaut: 4 },
      { description: 'Altération des consignes de procédé (SCADA / automates)', impacts: ['Accident industriel', 'Atteinte à l’environnement', 'Risque pour les opérateurs'], graviteDefaut: 4 },
      { description: 'Compromission via un accès de télémaintenance', impacts: ['Prise de contrôle des installations', 'Propagation IT → OT'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Acteur étatique ciblant les infrastructures (type Sandworm)', categorie: 'ETAT_NATION', description: 'Attaquant étatique cherchant à perturber ou saboter des systèmes industriels critiques', motivation: 'Déstabilisation / sabotage', ressources: 'Très élevées', pertinenceDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'D', nom: 'Sabotage de la production via le réseau OT (D)', description: 'Un attaquant atteint les automates et arrête les installations', vraisemblanceDefaut: 2, graviteDefaut: 4 },
      { critere: 'I', nom: 'Altération des consignes de procédé (I)', description: 'Modification malveillante des paramètres SCADA provoquant un incident', vraisemblanceDefaut: 2, graviteDefaut: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTEUR PUBLIC — administration, collectivités
// ─────────────────────────────────────────────────────────────────────────────
const PUBLIC: SectorFamily = {
  key: 'public',
  match: ['administration', 'public', 'collectivit', 'état', 'etat', 'government', 'mairie', 'commune', 'ministère', 'ministere', 'préfecture', 'prefecture'],
  exemples: {
    valeursMetier: [
      { nom: 'Services en ligne aux usagers', type: 'PROCESSUS', description: 'Téléservices et démarches administratives dématérialisées', responsable: 'DSI / Direction du numérique', disponibilite: 4, integrite: 3, confidentialite: 3, tracabilite: 3 },
      { nom: 'État civil et registres', type: 'INFORMATION', description: 'Actes d’état civil, listes électorales et registres officiels', responsable: 'Service de l’état civil', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4 },
      { nom: 'Gestion des délibérations et actes', type: 'PROCESSUS', description: 'Préparation, vote et publication des délibérations et arrêtés', responsable: 'Secrétariat général', disponibilite: 3, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Données fiscales et sociales des administrés', type: 'INFORMATION', description: 'Données fiscales, sociales et personnelles des usagers', responsable: 'Direction des finances / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
    ],
    biensSupports: [
      { nom: 'Portail de téléservices', type: 'LOGICIEL', description: 'Plateforme d’accès des usagers aux démarches en ligne' },
      { nom: 'Application métier d’état civil', type: 'LOGICIEL', description: 'Logiciel de gestion des actes et registres d’état civil' },
      { nom: 'Téléphonie et messagerie de la collectivité', type: 'RESEAU', description: 'Moyens de communication internes et avec les usagers' },
      { nom: 'Hébergement cloud qualifié (SecNumCloud)', type: 'SOUS_TRAITANCE', description: 'Prestataire qualifié hébergeant les services publics numériques' },
    ],
    evenementsRedoutes: [
      { description: 'Indisponibilité des services publics numériques', impacts: ['Usagers privés de démarches essentielles', 'Continuité du service public rompue'], graviteDefaut: 3 },
      { description: 'Fuite ou altération des données des administrés', impacts: ['Atteinte à la vie privée', 'Sanction RGPD', 'Perte de confiance des citoyens'], graviteDefaut: 4 },
      { description: 'Défiguration ou désinformation sur les canaux officiels', impacts: ['Atteinte à l’image de l’institution', 'Diffusion de fausses informations'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Hacktiviste visant l’institution publique', categorie: 'ACTIVISTE', description: 'Acteur idéologique cherchant à défigurer les sites ou divulguer des données pour porter un message politique', motivation: 'Idéologique', ressources: 'Moyennes', pertinenceDefaut: 2 },
    ],
    scenariosStrategiques: [
      { critere: 'D', nom: 'Blocage des téléservices par rançongiciel (D)', description: 'Un rançongiciel rend indisponibles les services en ligne aux usagers', vraisemblanceDefaut: 3, graviteDefaut: 3 },
      { critere: 'C', nom: 'Divulgation de données d’administrés (C)', description: 'Exfiltration puis publication de données personnelles des usagers', vraisemblanceDefaut: 2, graviteDefaut: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT / LOGISTIQUE
// ─────────────────────────────────────────────────────────────────────────────
const TRANSPORT: SectorFamily = {
  key: 'transport',
  match: ['transport', 'logistique', 'logistics', 'fret', 'ferroviaire', 'aérien', 'aerien', 'maritime', 'livraison'],
  exemples: {
    valeursMetier: [
      { nom: 'Planification et suivi des expéditions', type: 'PROCESSUS', description: 'Organisation, suivi et traçabilité des livraisons et du fret', responsable: 'Direction logistique / exploitation', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Gestion de la flotte et du transport', type: 'PROCESSUS', description: 'Affectation, géolocalisation et maintenance des véhicules', responsable: 'Direction de flotte / parc', disponibilite: 4, integrite: 3, confidentialite: 2, tracabilite: 3 },
      { nom: 'Réservation et billetterie', type: 'INFORMATION', description: 'Réservations, titres de transport et données voyageurs', responsable: 'Direction commerciale', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 3 },
      { nom: 'Exploitation et régulation du trafic', type: 'PROCESSUS', description: 'Supervision et régulation en temps réel des circulations', responsable: 'Poste de commandement / exploitation', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
    ],
    biensSupports: [
      { nom: 'Système de gestion d’entrepôt (WMS)', type: 'LOGICIEL', description: 'Pilotage des stocks, préparation et expédition des commandes' },
      { nom: 'Télématique embarquée / géolocalisation', type: 'MATERIEL', description: 'Boîtiers GPS et capteurs embarqués sur les véhicules' },
      { nom: 'Plateforme de réservation / billettique', type: 'LOGICIEL', description: 'Vente et validation des titres de transport' },
      { nom: 'Poste de commandement / supervision du trafic', type: 'LOGICIEL', description: 'Supervision et régulation des circulations en temps réel' },
      { nom: 'Système de gestion du transport (TMS)', type: 'LOGICIEL', description: 'Planification, optimisation et suivi des transports et tournées' },
      { nom: 'Chronotachygraphe numérique', type: 'MATERIEL', description: 'Enregistrement réglementaire des temps de conduite et de repos' },
      { nom: 'Échanges de données informatisées (EDI)', type: 'RESEAU', description: 'Interfaces d’échange avec clients, transporteurs et douanes' },
    ],
    evenementsRedoutes: [
      { description: 'Interruption de l’exploitation et des livraisons', impacts: ['Retards et ruptures d’approvisionnement', 'Perte de chiffre d’affaires', 'Atteinte aux engagements clients'], graviteDefaut: 4 },
      { description: 'Altération des données de suivi ou de régulation', impacts: ['Erreurs d’acheminement', 'Incident d’exploitation', 'Atteinte à la sécurité'], graviteDefaut: 4 },
      { description: 'Fuite de données voyageurs / clients', impacts: ['Atteinte à la vie privée', 'Sanction RGPD', 'Perte de confiance'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Cybercriminel ciblant la chaîne logistique', categorie: 'CYBERCRIMINEL', description: 'Cybercriminels visant les opérateurs logistiques pour rançon ou détournement de marchandises', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'D', nom: 'Blocage de l’exploitation par rançongiciel (D)', description: 'Un rançongiciel paralyse les systèmes d’exploitation et de livraison', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'I', nom: 'Détournement de marchandises via altération du suivi (I)', description: 'Un attaquant modifie les données de suivi pour détourner du fret', vraisemblanceDefaut: 2, graviteDefaut: 3 },
      { critere: 'I', nom: 'Sabotage GPS / routage frauduleux (I)', description: 'Un attaquant falsifie les données GPS pour détourner ou retarder des livraisons', vraisemblanceDefaut: 2, graviteDefaut: 3 },
      { critere: 'I', nom: 'Manipulation des chronotachygraphes (I)', description: 'Altération des données de temps de conduite (fraude réglementaire et risque pour la sécurité routière)', vraisemblanceDefaut: 2, graviteDefaut: 3 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// TÉLÉCOM
// ─────────────────────────────────────────────────────────────────────────────
const TELECOM: SectorFamily = {
  key: 'telecom',
  match: ['télécom', 'telecom', 'télécommunication', 'telecommunication', 'opérateur', 'operateur', 'telco', 'fai'],
  exemples: {
    valeursMetier: [
      { nom: 'Fourniture des services de communication', type: 'PROCESSUS', description: 'Acheminement de la voix, des données et de l’accès internet des abonnés', responsable: 'Direction réseau / production', disponibilite: 4, integrite: 3, confidentialite: 3, tracabilite: 3 },
      { nom: 'Gestion des abonnés et facturation', type: 'INFORMATION', description: 'Données d’abonnés, contrats et facturation', responsable: 'Direction commerciale / BSS', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Supervision et conduite du réseau', type: 'PROCESSUS', description: 'Pilotage, supervision et maintenance du réseau de télécommunications', responsable: 'Centre de supervision réseau (NOC)', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Interconnexion et roaming', type: 'PROCESSUS', description: 'Échanges de trafic avec les autres opérateurs et itinérance', responsable: 'Direction des interconnexions', disponibilite: 4, integrite: 3, confidentialite: 3, tracabilite: 3 },
    ],
    biensSupports: [
      { nom: 'Cœur de réseau (core network)', type: 'MATERIEL', description: 'Équipements centraux d’acheminement du trafic' },
      { nom: 'Stations de base / antennes', type: 'MATERIEL', description: 'Équipements radio d’accès des abonnés' },
      { nom: 'Systèmes de gestion des abonnés (BSS / OSS)', type: 'LOGICIEL', description: 'Gestion commerciale et technique des abonnés' },
      { nom: 'DNS et services d’infrastructure', type: 'RESEAU', description: 'Résolution de noms et services réseau critiques' },
    ],
    evenementsRedoutes: [
      { description: 'Indisponibilité du réseau / panne généralisée', impacts: ['Abonnés privés de communication', 'Atteinte aux services d’urgence', 'Sanction du régulateur'], graviteDefaut: 4 },
      { description: 'Interception ou écoute des communications', impacts: ['Atteinte à la confidentialité', 'Atteinte à la vie privée', 'Espionnage'], graviteDefaut: 4 },
      { description: 'Fuite de données d’abonnés', impacts: ['Atteinte à la vie privée', 'Sanction RGPD', 'Perte de confiance'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Acteur étatique d’espionnage des communications', categorie: 'ETAT_NATION', description: 'Attaquant étatique cherchant à intercepter ou perturber les communications', motivation: 'Renseignement', ressources: 'Très élevées', pertinenceDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'D', nom: 'Panne généralisée du réseau par sabotage (D)', description: 'Un attaquant provoque l’indisponibilité du cœur de réseau', vraisemblanceDefaut: 2, graviteDefaut: 4 },
      { critere: 'C', nom: 'Interception des communications des abonnés (C)', description: 'Un attaquant accède au trafic pour écouter les communications', vraisemblanceDefaut: 2, graviteDefaut: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉDUCATION / RECHERCHE
// ─────────────────────────────────────────────────────────────────────────────
const EDUCATION: SectorFamily = {
  key: 'education',
  match: ['éducation', 'education', 'enseign', 'université', 'universite', 'école', 'ecole', 'scolaire', 'recherche', 'academ', 'formation', 'school'],
  exemples: {
    valeursMetier: [
      { nom: 'Gestion de la scolarité et des examens', type: 'PROCESSUS', description: 'Inscriptions, notes, examens et délivrance des diplômes', responsable: 'Direction des études / scolarité', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4 },
      { nom: 'Dossiers des étudiants et personnels', type: 'INFORMATION', description: 'Données personnelles, scolaires et RH des étudiants et personnels', responsable: 'DSI / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3 },
      { nom: 'Travaux et données de recherche', type: 'INFORMATION', description: 'Résultats de recherche, données expérimentales et propriété intellectuelle', responsable: 'Direction de la recherche', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3 },
      { nom: 'Plateforme pédagogique (ENT / e-learning)', type: 'PROCESSUS', description: 'Accès aux cours, ressources et services numériques en ligne', responsable: 'DSI / Direction du numérique', disponibilite: 4, integrite: 3, confidentialite: 2, tracabilite: 3 },
    ],
    biensSupports: [
      { nom: 'Environnement numérique de travail (ENT)', type: 'LOGICIEL', description: 'Portail d’accès aux services numériques pédagogiques' },
      { nom: 'Système de gestion de la scolarité', type: 'LOGICIEL', description: 'Gestion des inscriptions, notes et diplômes' },
      { nom: 'Stockage et calcul des données de recherche', type: 'MATERIEL', description: 'Serveurs de stockage et de calcul scientifique' },
      { nom: 'Réseau et Wi-Fi du campus', type: 'RESEAU', description: 'Réseau d’accès des étudiants et personnels sur le campus' },
    ],
    evenementsRedoutes: [
      { description: 'Indisponibilité des services numériques pédagogiques', impacts: ['Interruption des cours et examens', 'Atteinte à la continuité pédagogique'], graviteDefaut: 3 },
      { description: 'Falsification de notes ou de diplômes', impacts: ['Atteinte à la valeur des diplômes', 'Fraude académique', 'Atteinte à la réputation'], graviteDefaut: 4 },
      { description: 'Vol de travaux de recherche / propriété intellectuelle', impacts: ['Perte d’avantage scientifique', 'Espionnage économique', 'Atteinte à la confidentialité'], graviteDefaut: 4 },
    ],
    sourcesRisque: [
      { nom: 'Acteur d’espionnage académique et scientifique', categorie: 'ETAT_NATION', description: 'Attaquant cherchant à dérober des travaux de recherche sensibles', motivation: 'Espionnage', ressources: 'Élevées', pertinenceDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'I', nom: 'Falsification des résultats académiques (I)', description: 'Un attaquant modifie notes ou diplômes via un compte compromis', vraisemblanceDefaut: 2, graviteDefaut: 4 },
      { critere: 'C', nom: 'Exfiltration de travaux de recherche (C)', description: 'Vol de données de recherche par un acteur d’espionnage', vraisemblanceDefaut: 2, graviteDefaut: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMERCE / DISTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────
const COMMERCE: SectorFamily = {
  key: 'commerce',
  match: ['commerce', 'distribution', 'retail', 'e-commerce', 'ecommerce', 'magasin', 'vente', 'grande distribution'],
  exemples: {
    valeursMetier: [
      { nom: 'Vente en ligne (e-commerce)', type: 'PROCESSUS', description: 'Catalogue, panier, commande et paiement en ligne', responsable: 'Direction e-commerce', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 3 },
      { nom: 'Encaissement et caisses (point de vente)', type: 'PROCESSUS', description: 'Encaissement, paiement et gestion des transactions en magasin', responsable: 'Direction des magasins / exploitation', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4 },
      { nom: 'Gestion des stocks et approvisionnement', type: 'PROCESSUS', description: 'Suivi des stocks, réassort et logistique amont', responsable: 'Direction supply chain', disponibilite: 3, integrite: 4, confidentialite: 2, tracabilite: 3 },
      { nom: 'Programme de fidélité et données clients', type: 'INFORMATION', description: 'Données clients, historique d’achats et fidélité', responsable: 'Direction marketing / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3 },
    ],
    biensSupports: [
      { nom: 'Plateforme e-commerce', type: 'LOGICIEL', description: 'Site marchand et back-office de gestion des commandes' },
      { nom: 'Terminaux de paiement et caisses', type: 'MATERIEL', description: 'TPE et systèmes d’encaissement en magasin' },
      { nom: 'Système de gestion des stocks (ERP / WMS)', type: 'LOGICIEL', description: 'Gestion des stocks, commandes et approvisionnement' },
      { nom: 'Base de données clients / CRM', type: 'DONNEES', description: 'Données clients, fidélité et historique d’achats' },
    ],
    evenementsRedoutes: [
      { description: 'Indisponibilité du site marchand / des caisses', impacts: ['Perte de chiffre d’affaires', 'Atteinte à l’image', 'Clients mécontents'], graviteDefaut: 4 },
      { description: 'Vol de données de cartes de paiement', impacts: ['Fraude à la carte bancaire', 'Sanction PCI-DSS', 'Atteinte à la réputation'], graviteDefaut: 4 },
      { description: 'Fuite de la base de données clients', impacts: ['Atteinte à la vie privée', 'Sanction RGPD', 'Perte de confiance'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Groupe de vol de données de paiement (Magecart)', categorie: 'CYBERCRIMINEL', description: 'Cybercriminels ciblant les sites marchands et caisses pour voler des données de paiement', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'D', nom: 'Indisponibilité du site marchand par DDoS (D)', description: 'Une attaque par déni de service rend le site marchand indisponible', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'C', nom: 'Vol de données de paiement par injection web (C)', description: 'Un script malveillant exfiltre les données de carte lors du paiement', vraisemblanceDefaut: 3, graviteDefaut: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONS JURIDIQUES / CABINET D'AVOCATS
// ─────────────────────────────────────────────────────────────────────────────
const JURIDIQUE: SectorFamily = {
  key: 'juridique',
  match: ['juridique', 'avocat', 'notaire', 'juriste', 'barreau', 'legal'],
  exemples: {
    valeursMetier: [
      { nom: 'Gestion des dossiers clients', type: 'PROCESSUS', description: 'Suivi des affaires, pièces et échéances des dossiers clients', responsable: 'Associé / avocat responsable du dossier', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Correspondances et secret professionnel', type: 'INFORMATION', description: 'Échanges confidentiels avocat-client couverts par le secret professionnel', responsable: 'Associé / avocat responsable du dossier', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Maniement de fonds clients (CARPA)', type: 'PROCESSUS', description: 'Gestion des fonds des clients via la CARPA', responsable: 'Direction financière du cabinet', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Dossiers sensibles (M&A, contentieux)', type: 'INFORMATION', description: 'Données confidentielles d’opérations M&A, due diligence et contentieux', responsable: 'Associé en charge du dossier', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3 },
    ],
    biensSupports: [
      { nom: 'Logiciel de gestion de cabinet', type: 'LOGICIEL', description: 'Application métier de gestion des dossiers, du temps et de la facturation' },
      { nom: 'Coffre-fort électronique / GED', type: 'LOGICIEL', description: 'Stockage sécurisé et archivage des actes et pièces' },
      { nom: 'Plateformes e-procédure (RPVA, Télérecours)', type: 'RESEAU', description: 'Accès aux juridictions et dépôt dématérialisé des actes' },
      { nom: 'Data room sécurisée', type: 'SOUS_TRAITANCE', description: 'Espace cloud de partage de pièces pour les opérations sensibles' },
    ],
    evenementsRedoutes: [
      { description: 'Divulgation de pièces couvertes par le secret professionnel', impacts: ['Violation du secret professionnel', 'Sanction déontologique', 'Préjudice grave au client'], graviteDefaut: 4 },
      { description: 'Indisponibilité des dossiers et de l’e-procédure', impacts: ['Forclusion / délais procéduraux manqués', 'Interruption de l’activité du cabinet'], graviteDefaut: 4 },
      { description: 'Détournement de fonds clients (CARPA)', impacts: ['Perte financière pour les clients', 'Sanction de l’Ordre', 'Atteinte à la réputation'], graviteDefaut: 4 },
    ],
    sourcesRisque: [
      { nom: 'Cybercriminel ciblant les cabinets d’avocats', categorie: 'CYBERCRIMINEL', description: 'Attaquants visant les données confidentielles et les fonds des cabinets (rançongiciel, fraude au virement)', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'C', nom: 'Fuite de dossiers confidentiels clients (C)', description: 'Exfiltration de pièces couvertes par le secret professionnel par un cybercriminel', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'D', nom: 'Blocage du cabinet par rançongiciel (D)', description: 'Un rançongiciel chiffre les dossiers et bloque l’accès à l’e-procédure', vraisemblanceDefaut: 3, graviteDefaut: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// INFORMATIQUE / NUMÉRIQUE — éditeurs SaaS, startups, cloud-native
// ─────────────────────────────────────────────────────────────────────────────
const NUMERIQUE: SectorFamily = {
  key: 'numerique',
  match: ['informatique', 'numérique', 'numerique', 'saas', 'startup', 'logiciel', 'éditeur', 'editeur', 'digital'],
  exemples: {
    valeursMetier: [
      { nom: 'Plateforme SaaS (service rendu aux clients)', type: 'PROCESSUS', description: 'Disponibilité et intégrité du service applicatif fourni aux clients', responsable: 'Direction technique (CTO)', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 3 },
      { nom: 'Code source et propriété intellectuelle', type: 'INFORMATION', description: 'Dépôts de code, secrets et savoir-faire technique', responsable: 'Direction technique (CTO)', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Données clients hébergées (multi-tenant)', type: 'INFORMATION', description: 'Données des clients traitées et stockées dans la plateforme', responsable: 'RSSI / DPO', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Chaîne de build et de déploiement (CI/CD)', type: 'PROCESSUS', description: 'Intégration et livraison continues vers la production', responsable: 'Équipe DevOps / plateforme', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4 },
    ],
    biensSupports: [
      { nom: 'Pipeline CI/CD (GitHub Actions, GitLab CI)', type: 'LOGICIEL', description: 'Chaîne d’intégration et de déploiement continus' },
      { nom: 'Registre de conteneurs (Docker Hub, ECR)', type: 'LOGICIEL', description: 'Stockage des images de conteneurs déployées' },
      { nom: 'Gestionnaire de secrets (Vault, Secrets Manager)', type: 'LOGICIEL', description: 'Stockage centralisé des secrets et clés d’API' },
      { nom: 'Infrastructure as Code (Terraform, Pulumi)', type: 'LOGICIEL', description: 'Provisionnement et configuration déclaratifs du cloud' },
      { nom: 'Hébergement cloud (IaaS/PaaS) et API Gateway', type: 'SOUS_TRAITANCE', description: 'Infrastructure cloud d’exécution et exposition des API' },
    ],
    evenementsRedoutes: [
      { description: 'Compromission de la chaîne logicielle (supply chain)', impacts: ['Code malveillant en production', 'Atteinte à tous les clients', 'Perte de confiance'], graviteDefaut: 4 },
      { description: 'Fuite de secrets ou de clés d’API', impacts: ['Accès non autorisé à l’infrastructure', 'Exfiltration de données clients'], graviteDefaut: 4 },
      { description: 'Indisponibilité prolongée de la plateforme SaaS', impacts: ['Rupture de service pour tous les clients', 'Pénalités SLA', 'Atteinte à la réputation'], graviteDefaut: 4 },
    ],
    sourcesRisque: [
      { nom: 'Attaquant ciblant la chaîne d’approvisionnement logicielle', categorie: 'CYBERCRIMINEL', description: 'Acteur compromettant une dépendance, un build ou un registre pour atteindre les clients en aval', motivation: 'Lucratif / sabotage', ressources: 'Élevées', pertinenceDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'I', nom: 'Injection de code via le pipeline CI/CD (I)', description: 'Un attaquant compromet le pipeline et injecte du code malveillant en production', vraisemblanceDefaut: 2, graviteDefaut: 4 },
      { critere: 'C', nom: 'Exfiltration de données clients via secrets fuités (C)', description: 'Des secrets exposés permettent l’accès et l’exfiltration des données clients', vraisemblanceDefaut: 3, graviteDefaut: 4 },
    ],
  },
}

export const SECTOR_FAMILIES: SectorFamily[] = [SANTE, FINANCE, INDUSTRIE, PUBLIC, TRANSPORT, TELECOM, EDUCATION, COMMERCE, JURIDIQUE, NUMERIQUE]

/**
 * Exemples sectoriels pour un secteur + une catégorie d'atelier.
 * [] si le secteur n'appartient à aucune famille connue ou si la catégorie
 * n'est pas couverte par cette famille.
 */
export function sectorExemplesFor(
  secteur: string | null | undefined,
  category: SectorExempleCategory,
  locale: Locale = 'fr',
): Record<string, unknown>[] {
  const s = (secteur ?? '').toLowerCase()
  if (!s) return []
  const fam = SECTOR_FAMILIES.find(f => f.match.some(m => s.includes(m)))
  if (!fam) return []
  const items = fam.exemples[category] ?? []
  const dict = DICTS[locale]
  if (!dict) return items // FR (source) ou locale sans dictionnaire
  return items.map((item, idx) => localizeItem(item, `${fam.key}.${category}.${idx}`, dict))
}

/** Applique les traductions à un exemple (repli sur le texte FR source si clé absente). */
function localizeItem(
  item: Record<string, unknown>,
  prefix: string,
  dict: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...item }
  for (const field of TEXT_FIELDS) {
    if (typeof out[field] === 'string') {
      out[field] = dict[`${prefix}.${field}`] ?? out[field]
    }
  }
  if (Array.isArray(out.impacts)) {
    out.impacts = (out.impacts as string[]).map((s, j) => dict[`${prefix}.impacts.${j}`] ?? s)
  }
  return out
}

/**
 * Fusionne les exemples sectoriels (en tête) avec le catalogue générique, en
 * dédupliquant par `nom` (repli `description`). Renvoie le catalogue tel quel si
 * aucun pack ne correspond au secteur. Non destructif.
 */
export function withSectorExemples<T extends Record<string, unknown>>(
  generic: T[],
  secteur: string | null | undefined,
  category: SectorExempleCategory,
  locale: Locale = 'fr',
): T[] {
  const sector = sectorExemplesFor(secteur, category, locale) as T[]
  if (!sector.length) return generic
  const keyOf = (e: T) =>
    String((e as { nom?: unknown }).nom ?? (e as { description?: unknown }).description ?? '')
      .toLowerCase()
      .trim()
  const seen = new Set(sector.map(keyOf))
  return [...sector, ...generic.filter(g => !seen.has(keyOf(g)))]
}
