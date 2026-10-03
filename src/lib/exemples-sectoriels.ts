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
import { extItemsFor, localizeExt } from '@/lib/exemples-sectoriels-ext'
import { SOUS_SECTEURS } from '@/lib/ebios-data'
import { secteurFamily, selectableSousSecteurIds } from '@/lib/sous-secteurs'
import { isPatternCode } from '@/lib/patterns-archi'
import { patternExemplesFor } from '@/lib/exemples-patterns'

/** Catégorie d'exemples sectoriels (sous-ensemble des catégories d'atelier proposées par secteur). */
export type SectorExempleCategory =
  | 'valeursMetier'
  | 'biensSupports'
  | 'evenementsRedoutes'
  | 'sourcesRisque'
  | 'scenariosStrategiques'
  | 'partiesPrenantes'
  // Ateliers 3 à 5 (contenu d'extension, cf. exemples-sectoriels-ext.ts)
  | 'actionsElementaires'
  | 'mesuresEcosysteme'
  | 'mesures'

// Dictionnaires de traduction (FR = source dans les données ci-dessous, donc absent).
// Clé : `${famille}.${categorie}.${index}.${champ}` (+ `.impacts.${j}` pour les tableaux).
const DICTS: Partial<Record<Locale, Record<string, string>>> = { en, de, es, it }
const TEXT_FIELDS = ['nom', 'description', 'motivation', 'ressources']

/** Famille sectorielle : motifs reconnus dans le libellé du secteur + exemples associés. */
export interface SectorFamily {
  /** Sous-chaînes (minuscules) reconnues dans le libellé du secteur de l'analyse. */
  match: string[]
  /** Identifiant interne de la famille. */
  key: 'sante' | 'finance' | 'industrie' | 'public' | 'transport' | 'telecom' | 'education' | 'commerce' | 'juridique' | 'numerique' | 'agri' | 'defense' | 'immobilier' | 'media' | 'tourisme' | 'association' | 'technique' | 'protection_sociale'
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
      { nom: 'Prise en charge des patients aux urgences', type: 'PROCESSUS', description: 'Accueil, tri, soins et orientation des patients en situation d’urgence', responsable: 'Direction des soins / service des urgences', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 3, sousProfession: 'hopital' },
      { nom: 'Dossier Patient Informatisé (DPI)', type: 'INFORMATION', description: 'Données de santé, antécédents, prescriptions et comptes rendus des patients', responsable: 'DSI / Direction des systèmes d’information', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'hopital' },
      { nom: 'Circuit du médicament', type: 'PROCESSUS', description: 'Prescription, dispensation et administration des traitements', responsable: 'Pharmacie à usage intérieur', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'hopital' },
      { nom: 'Imagerie médicale (PACS)', type: 'INFORMATION', description: 'Images radiologiques et comptes rendus d’examens des patients', responsable: 'Service d’imagerie médicale', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'hopital' },
      // Aide à domicile / SAAD-SAP (issue #115) — sousProfession 'saad'
      { nom: 'Coordination des interventions à domicile', type: 'PROCESSUS', description: 'Planification et suivi des interventions des aides à domicile chez les personnes accompagnées', responsable: 'Responsable de secteur', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 3, sousProfession: 'saad' },
      { nom: 'Données des personnes aidées', type: 'INFORMATION', description: 'Coordonnées, situation de dépendance et parfois données de santé des bénéficiaires (RGPD art. 9)', responsable: 'Direction / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'saad' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { nom: 'Dossier médical des patients du cabinet', type: 'INFORMATION', description: 'Dossier patient tenu dans le logiciel de gestion de cabinet : antécédents, ordonnances, comptes rendus', responsable: 'Professionnel de santé / responsable du cabinet', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'cabinet' },
      { nom: 'Facturation et télétransmission des actes à l’Assurance Maladie', type: 'PROCESSUS', description: 'Feuilles de soins électroniques, tiers payant et rapprochement des paiements', responsable: 'Professionnel de santé / secrétariat', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'cabinet' },
      { nom: 'Prise de rendez-vous et continuité des consultations', type: 'PROCESSUS', description: 'Agenda, rappels aux patients et téléconsultation', responsable: 'Secrétariat / professionnel de santé', disponibilite: 3, integrite: 3, confidentialite: 3, tracabilite: 2, sousProfession: 'cabinet' },
      { nom: 'Gestion administrative et comptable des professionnels rattachés', type: 'PROCESSUS', description: 'Comptabilité, répartition des charges et des honoraires, déclarations sociales et fiscales', responsable: 'Gérant / responsable administratif', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'gestionpro' },
      { nom: 'Données des professionnels et de leurs patients gérées pour le compte des cabinets', type: 'INFORMATION', description: 'Identités, rémunérations, contrats et, selon le service rendu, données de patients (RGPD art. 9)', responsable: 'Gérant / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'gestionpro' },
      { nom: 'Paie et rémunération des collaborateurs et remplaçants', type: 'PROCESSUS', description: 'Paie, charges sociales et paiements aux remplaçants', responsable: 'Responsable administratif', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'gestionpro' },
      { nom: 'Liquidation et paiement des prestations aux assurés et aux professionnels', type: 'PROCESSUS', description: 'Calcul, contrôle et paiement des remboursements et des feuilles de soins', responsable: 'Direction des prestations / DSI', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'amo' },
      { nom: 'Droits et données de santé des assurés', type: 'INFORMATION', description: 'Ouverture des droits, situation sociale et données de remboursement révélant l’état de santé (RGPD art. 9)', responsable: 'Direction des assurés / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'amo' },
      { nom: 'Lutte contre la fraude et contrôle médical', type: 'PROCESSUS', description: 'Détection des facturations abusives ou fictives et contrôle des prestations', responsable: 'Direction du contrôle / lutte contre la fraude', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'amo' },
      { nom: 'Remboursements complémentaires et décomptes', type: 'PROCESSUS', description: 'Calcul et paiement des garanties santé après intervention de l’assurance maladie obligatoire', responsable: 'Direction des prestations santé', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'amc' },
      { nom: 'Données de santé des adhérents et ayants droit', type: 'INFORMATION', description: 'Données de remboursement, devis et pièces médicales (optique, dentaire, hospitalisation) — RGPD art. 9', responsable: 'Direction des adhérents / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'amc' },
      { nom: 'Cotisations, adhésions et recouvrement', type: 'PROCESSUS', description: 'Appels de cotisations, prélèvements, radiations et gestion des contrats collectifs', responsable: 'Direction technique / recouvrement', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'amc' },
      { nom: 'Gestion des droits et des prises en charge en tiers payant', type: 'PROCESSUS', description: 'Vérification des droits en temps réel et accords de prise en charge pour les professionnels de santé', responsable: 'Direction des opérations / DSI', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'tierspayant' },
      { nom: 'Conventionnement et tarifs des réseaux de soins', type: 'INFORMATION', description: 'Contrats, grilles tarifaires et engagements des professionnels partenaires', responsable: 'Direction des réseaux', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 3, sousProfession: 'tierspayant' },
      { nom: 'Flux de facturation avec les professionnels et les organismes', type: 'PROCESSUS', description: 'Échange et rapprochement des demandes de paiement entre professionnels, assurance maladie obligatoire et complémentaires', responsable: 'Direction financière', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'tierspayant' },
      { nom: 'Résultats d’analyses de biologie médicale', type: 'INFORMATION', description: 'Résultats, valeurs critiques et comptes rendus transmis aux prescripteurs et aux patients', responsable: 'Biologiste responsable', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'labo' },
      { nom: 'Chaîne pré-analytique et analytique', type: 'PROCESSUS', description: 'Identification des échantillons, passage sur automates, validation biologique', responsable: 'Biologiste responsable / qualité', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'labo' },
      { nom: 'Facturation des actes de biologie', type: 'PROCESSUS', description: 'Télétransmission aux organismes d’assurance maladie et rapprochement des paiements', responsable: 'Responsable administratif', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'labo' },
      { nom: 'Dispensation et délivrance des médicaments', type: 'PROCESSUS', description: 'Analyse des ordonnances, délivrance, conseil et traçabilité des produits', responsable: 'Pharmacien titulaire', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'officine' },
      { nom: 'Facturation à l’Assurance Maladie et aux complémentaires (tiers payant)', type: 'PROCESSUS', description: 'Télétransmission, tiers payant et rapprochement des paiements des organismes', responsable: 'Pharmacien titulaire / comptabilité', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'officine' },
      { nom: 'Dossier pharmaceutique et données des patients', type: 'INFORMATION', description: 'Historique de délivrance et données de santé des patients de l’officine (RGPD art. 9)', responsable: 'Pharmacien titulaire / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'officine' },
      { nom: 'Examens d’imagerie et comptes rendus', type: 'INFORMATION', description: 'Images, protocoles d’irradiation et comptes rendus des examens', responsable: 'Médecin responsable', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'imagerie' },
      { nom: 'Plateau technique (scanner, IRM, accélérateurs, générateurs de dialyse)', type: 'PROCESSUS', description: 'Équipements lourds dont l’arrêt ou le dérèglement affecte directement la sécurité des patients', responsable: 'Direction technique / physique médicale', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4, sousProfession: 'imagerie' },
      { nom: 'Régulation et planification des transports sanitaires', type: 'PROCESSUS', description: 'Prise de commandes, affectation des équipages et suivi des véhicules', responsable: 'Responsable d’exploitation', disponibilite: 4, integrite: 3, confidentialite: 3, tracabilite: 3, sousProfession: 'transport' },
      { nom: 'Facturation des transports à l’Assurance Maladie', type: 'PROCESSUS', description: 'Prescriptions médicales de transport, bons de transport et télétransmission', responsable: 'Gérant / comptabilité', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'transport' },
      { nom: 'Données des patients transportés', type: 'INFORMATION', description: 'Identité, adresses, pathologies et déplacements récurrents (dialyse, chimiothérapie) — RGPD art. 9', responsable: 'Gérant / DPO', disponibilite: 3, integrite: 3, confidentialite: 4, tracabilite: 3, sousProfession: 'transport' },
      { nom: 'Délivrance d’équipements sur prescription (optique, audition, orthopédie)', type: 'PROCESSUS', description: 'Prise de mesures, prescriptions, devis, commande et délivrance', responsable: 'Responsable du magasin / du centre', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 3, sousProfession: 'dm' },
      { nom: 'Facturation en tiers payant (assurance maladie obligatoire et complémentaires)', type: 'PROCESSUS', description: 'Dossiers 100 % santé, devis normalisés et télétransmission aux organismes', responsable: 'Responsable administratif', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'dm' },
      { nom: 'Données de santé des clients (ordonnances, corrections, appareillage)', type: 'INFORMATION', description: 'Données de santé et de remboursement des clients (RGPD art. 9)', responsable: 'Responsable / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'dm' },
      { nom: 'Service de télémédecine ou plateforme de rendez-vous', type: 'PROCESSUS', description: 'Consultations à distance, prise de rendez-vous et échanges patients-professionnels', responsable: 'Direction produit / exploitation', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'esante' },
      { nom: 'Données de santé hébergées pour le compte de clients', type: 'INFORMATION', description: 'Dossiers et documents de santé confiés par les établissements et professionnels clients (RGPD art. 9)', responsable: 'RSSI / DPO', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'esante' },
      { nom: 'Interopérabilité avec les services nationaux (messagerie sécurisée, dossier partagé)', type: 'PROCESSUS', description: 'Échanges avec les services publics de santé numérique et les logiciels des professionnels', responsable: 'Direction produit / RSSI', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'esante' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { nom: 'Téléconsultation et prise de rendez-vous en ligne', type: 'PROCESSUS', description: 'Plateforme de rendez-vous en ligne et de consultation à distance utilisée par les patients du cabinet', responsable: 'Médecins / secrétariat', disponibilite: 3, integrite: 3, confidentialite: 4, tracabilite: 3, sousProfession: 'cabinet' },
      { nom: 'Gestion des remplaçants et collaborateurs saisonniers', type: 'PROCESSUS', description: 'Accueil des remplaçants : droits d’accès nominatifs, carte de professionnel de santé, convention de remplacement et retrait des accès à leur départ', responsable: 'Médecin responsable du cabinet', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'cabinet' },
    ],
    biensSupports: [
      { nom: 'Système d’information hospitalier (SIH / DPI)', type: 'LOGICIEL', description: 'Application centrale hébergeant les dossiers patients', sousProfession: 'hopital' },
      { nom: 'Serveur d’imagerie (PACS)', type: 'LOGICIEL', description: 'Stockage et diffusion des images médicales', sousProfession: 'hopital' },
      { nom: 'Dispositifs médicaux connectés', type: 'MATERIEL', description: 'Pompes, moniteurs, respirateurs et automates de biologie reliés au réseau', sousProfession: 'hopital' },
      { nom: 'Hébergeur de données de santé (HDS)', type: 'SOUS_TRAITANCE', description: 'Prestataire certifié HDS hébergeant les données de santé' },
      // Aide à domicile / SAAD-SAP (issue #115)
      { nom: 'Logiciel de télégestion (Filien, Ximi, Apologic, Ogust)', type: 'LOGICIEL', description: 'Planification, pointage et facturation des interventions à domicile', sousProfession: 'saad' },
      { nom: 'Tablettes / smartphones des intervenants', type: 'MATERIEL', description: 'Terminaux mobiles des intervenants terrain (pointage, données des aidés)', sousProfession: 'saad' },
      { nom: 'CESU dématérialisé', type: 'SOUS_TRAITANCE', description: 'Titre de paiement dématérialisé des prestations à domicile', sousProfession: 'saad' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { nom: 'Logiciel de gestion de cabinet (LGC)', type: 'LOGICIEL', description: 'Application métier tenant le dossier patient, l’agenda et la facturation', sousProfession: 'cabinet' },
      { nom: 'Carte de professionnel de santé (CPS / e-CPS) et lecteur de carte Vitale', type: 'MATERIEL', description: 'Moyens d’authentification et de facturation du professionnel, dont la perte permet des usurpations', sousProfession: 'cabinet' },
      { nom: 'Messagerie sécurisée de santé et poste de travail du cabinet', type: 'LOGICIEL', description: 'Échanges de comptes rendus et d’ordonnances avec confrères, laboratoires et établissements', sousProfession: 'cabinet' },
      { nom: 'Logiciel de comptabilité, de paie et de gestion des honoraires', type: 'LOGICIEL', description: 'Applications financières partagées par plusieurs cabinets ou professionnels', sousProfession: 'gestionpro' },
      { nom: 'Espace de partage de documents avec les professionnels adhérents', type: 'SOUS_TRAITANCE', description: 'Dépôt de pièces comptables, contrats, bulletins de paie et pièces de patients', sousProfession: 'gestionpro' },
      { nom: 'Chaîne de liquidation des prestations', type: 'LOGICIEL', description: 'Applications calculant et ordonnançant les remboursements et paiements aux professionnels', sousProfession: 'amo' },
      { nom: 'Référentiel des bénéficiaires et des droits', type: 'DONNEES', description: 'Base de référence des assurés, ayants droit et situations de couverture', sousProfession: 'amo' },
      { nom: 'Portails des assurés et des professionnels de santé', type: 'LOGICIEL', description: 'Services en ligne d’accès aux droits, remboursements et télé-services', sousProfession: 'amo' },
      { nom: 'Plateforme de gestion santé et prévoyance', type: 'LOGICIEL', description: 'Progiciel de gestion des adhésions, garanties, décomptes et cotisations', sousProfession: 'amc' },
      { nom: 'Flux d’échange avec l’assurance maladie obligatoire', type: 'RESEAU', description: 'Retours de remboursement et flux de droits indispensables au calcul des prestations', sousProfession: 'amc' },
      { nom: 'Plateforme de tiers payant et de gestion des accords de prise en charge', type: 'LOGICIEL', description: 'Services de vérification de droits et de calcul en temps réel utilisés par les professionnels', sousProfession: 'tierspayant' },
      { nom: 'Interfaces avec les logiciels des professionnels de santé', type: 'RESEAU', description: 'API et connecteurs exposés aux pharmacies, opticiens et établissements', sousProfession: 'tierspayant' },
      { nom: 'Système de gestion de laboratoire (SGL)', type: 'LOGICIEL', description: 'Application centrale d’enregistrement des demandes, résultats et validation', sousProfession: 'labo' },
      { nom: 'Automates d’analyse connectés', type: 'MATERIEL', description: 'Instruments de biologie reliés au SGL dont la compromission peut fausser des résultats', sousProfession: 'labo' },
      { nom: 'Logiciel de gestion d’officine (LGO)', type: 'LOGICIEL', description: 'Application de dispensation, stock, facturation et dossier pharmaceutique', sousProfession: 'officine' },
      { nom: 'Automate de stockage et terminaux de caisse', type: 'MATERIEL', description: 'Équipements connectés au LGO dont l’arrêt bloque la délivrance', sousProfession: 'officine' },
      { nom: 'Système d’information radiologique et archivage d’images (RIS / PACS)', type: 'LOGICIEL', description: 'Planification, stockage et diffusion des images et comptes rendus', sousProfession: 'imagerie' },
      { nom: 'Équipements lourds connectés (scanner, IRM, accélérateurs, générateurs de dialyse)', type: 'MATERIEL', description: 'Équipements pilotés par logiciel dont la mise à jour est souvent dépendante du fabricant', sousProfession: 'imagerie' },
      { nom: 'Logiciel de régulation et de facturation des transports', type: 'LOGICIEL', description: 'Application de planification, géolocalisation et télétransmission des bons de transport', sousProfession: 'transport' },
      { nom: 'Terminaux embarqués et smartphones des équipages', type: 'MATERIEL', description: 'Terminaux mobiles contenant des données de patients et des lecteurs de cartes', sousProfession: 'transport' },
      { nom: 'Logiciel de gestion de magasin (optique, audition, orthopédie)', type: 'LOGICIEL', description: 'Clients, prescriptions, devis, stocks et facturation', sousProfession: 'dm' },
      { nom: 'Plateforme de télétransmission et de demande de prise en charge', type: 'SOUS_TRAITANCE', description: 'Services d’échange avec les organismes d’assurance maladie obligatoire et complémentaire', sousProfession: 'dm' },
      { nom: 'Plateforme SaaS de santé numérique', type: 'LOGICIEL', description: 'Service multi-clients exposé sur Internet traitant des données de santé', sousProfession: 'esante' },
      { nom: 'Interfaces et connecteurs vers les services nationaux et les logiciels de santé', type: 'RESEAU', description: 'API, certificats et flux d’interopérabilité dont la compromission expose plusieurs clients', sousProfession: 'esante' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { nom: 'Box internet et réseau local du cabinet (Wi-Fi, objets connectés)', type: 'RESEAU', description: 'Accès internet souvent grand public, mot de passe d’administration d’origine, réseau unique mêlant postes médicaux, Wi-Fi des patients et objets connectés', sousProfession: 'cabinet' },
      { nom: 'Comptes des remplaçants et comptes partagés des postes de consultation', type: 'ORGANISATION', description: 'Identifiants nominatifs ou, trop souvent, partagés ; fin de droits non pilotée à la date de fin de remplacement', sousProfession: 'cabinet' },
      { nom: 'Plateforme de téléconsultation et de prise de rendez-vous en ligne', type: 'SOUS_TRAITANCE', description: 'Service tiers hébergeant l’agenda et les échanges avec les patients', sousProfession: 'cabinet' },
    ],
    evenementsRedoutes: [
      { description: 'Indisponibilité du SIH bloquant la prise en charge des patients', impacts: ['Report de soins et d’interventions', 'Risque vital pour les patients', 'Bascule en mode dégradé papier'], graviteDefaut: 4, sousProfession: 'hopital' },
      { description: 'Fuite massive de dossiers patients (données de santé)', impacts: ['Atteinte à la vie privée des patients', 'Sanction CNIL (RGPD art. 9)', 'Perte de confiance'], graviteDefaut: 4 },
      { description: 'Altération de prescriptions ou de paramètres de dispositifs médicaux', impacts: ['Erreur de traitement', 'Risque vital pour les patients'], graviteDefaut: 4, sousProfession: 'hopital' },
      // Aide à domicile / SAAD-SAP (issue #115)
      { description: 'Vol d’une tablette d’intervenant exposant les données des personnes vulnérables', impacts: ['Violation de données (RGPD art. 9)', 'Sanction CNIL', 'Préjudice pour des personnes vulnérables'], graviteDefaut: 4, sousProfession: 'saad' },
      { description: 'Indisponibilité de la télégestion bloquant l’envoi des intervenants', impacts: ['Interruption des interventions à domicile', 'Risque pour des personnes dépendantes', 'Perte de facturation'], graviteDefaut: 4, sousProfession: 'saad' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { description: 'Chiffrement du dossier patient par un rançongiciel, cabinet à l’arrêt', impacts: ['Consultations reportées', 'Perte de données de santé', 'Violation à notifier (RGPD)'], graviteDefaut: 3, sousProfession: 'cabinet' },
      { description: 'Usurpation de la carte ou des identifiants du professionnel pour facturer à tort', impacts: ['Facturation frauduleuse imputée au professionnel', 'Indus à rembourser et enquête de l’assurance maladie', 'Atteinte à la réputation'], graviteDefaut: 3, sousProfession: 'cabinet' },
      { description: 'Détournement de paiements ou de coordonnées bancaires des professionnels rattachés', impacts: ['Perte financière pour plusieurs cabinets', 'Responsabilité du gestionnaire', 'Perte de confiance des adhérents'], graviteDefaut: 3, sousProfession: 'gestionpro' },
      { description: 'Fuite des données des professionnels et de leurs patients hébergées chez le gestionnaire', impacts: ['Violation de données de santé (RGPD art. 9)', 'Sanction de l’autorité de contrôle', 'Responsabilité contractuelle envers les cabinets'], graviteDefaut: 4, sousProfession: 'gestionpro' },
      { description: 'Versement de prestations indues ou détournées par la fraude (faux professionnels, faux assurés, coordonnées bancaires modifiées)', impacts: ['Perte financière pour les fonds publics', 'Atteinte à la confiance des assurés', 'Contrôles et enquêtes lourds'], graviteDefaut: 4, sousProfession: 'amo' },
      { description: 'Indisponibilité de la liquidation ou des portails : remboursements et paiements aux professionnels retardés', impacts: ['Professionnels et assurés privés de remboursement', 'Difficultés de trésorerie des cabinets et officines', 'Mission de service public dégradée'], graviteDefaut: 4, sousProfession: 'amo' },
      { description: 'Fuite massive de données de santé et de situation sociale des assurés', impacts: ['Atteinte grave à la vie privée de millions de personnes', 'Sanction de l’autorité de contrôle', 'Hameçonnage ciblé des assurés'], graviteDefaut: 4, sousProfession: 'amo' },
      { description: 'Fuite des données de santé des adhérents et ayants droit', impacts: ['Violation de données sensibles (RGPD art. 9)', 'Sanction de l’autorité de contrôle', 'Perte d’adhérents'], graviteDefaut: 4, sousProfession: 'amc' },
      { description: 'Remboursements erronés ou frauduleux (faux justificatifs, devis falsifiés, flux de droits erronés)', impacts: ['Prestations indues', 'Dégradation du ratio sinistres/cotisations', 'Hausse des cotisations'], graviteDefaut: 3, sousProfession: 'amc' },
      { description: 'Indisponibilité du service de droits en temps réel : professionnels contraints de faire l’avance de frais', impacts: ['Patients privés du tiers payant', 'Pénalités ou ruptures de contrat avec les organismes', 'Perte de confiance des professionnels'], graviteDefaut: 3, sousProfession: 'tierspayant' },
      { description: 'Altération des droits ou des tarifs transmis aux professionnels', impacts: ['Paiements erronés à grande échelle', 'Litiges avec les organismes et les professionnels', 'Perte financière'], graviteDefaut: 3, sousProfession: 'tierspayant' },
      { description: 'Altération ou perte de résultats d’analyses (erreur d’identification, automate compromis)', impacts: ['Erreur de diagnostic ou de traitement', 'Risque vital pour des patients', 'Perte d’accréditation'], graviteDefaut: 4, sousProfession: 'labo' },
      { description: 'Rançongiciel sur le SGL : arrêt de la rédaction et de la transmission des résultats', impacts: ['Résultats urgents non transmis', 'Prise en charge des patients retardée', 'Perte de chiffre d’affaires'], graviteDefaut: 4, sousProfession: 'labo' },
      { description: 'Arrêt du logiciel d’officine : délivrance et facturation impossibles', impacts: ['Patients sans traitement', 'Perte de chiffre d’affaires', 'Retard de paiement des organismes'], graviteDefaut: 3, sousProfession: 'officine' },
      { description: 'Facturation de médicaments non délivrés ou usurpation des identifiants de l’officine', impacts: ['Indus de l’assurance maladie', 'Poursuites ou sanctions', 'Atteinte à la réputation'], graviteDefaut: 3, sousProfession: 'officine' },
      { description: 'Dérèglement ou arrêt d’un équipement lourd piloté par logiciel', impacts: ['Risque pour la sécurité des patients (irradiation, séance interrompue)', 'Annulation d’examens', 'Coût de remise en conformité'], graviteDefaut: 4, sousProfession: 'imagerie' },
      { description: 'Fuite ou indisponibilité des images et comptes rendus (PACS)', impacts: ['Violation de données de santé', 'Retard de diagnostic', 'Sanction de l’autorité de contrôle'], graviteDefaut: 4, sousProfession: 'imagerie' },
      { description: 'Facturation de transports fictifs ou falsification des bons de transport', impacts: ['Indus et sanctions de l’assurance maladie', 'Déconventionnement', 'Poursuites pénales'], graviteDefaut: 3, sousProfession: 'transport' },
      { description: 'Panne de la régulation ou de la géolocalisation : transports urgents ou récurrents non assurés', impacts: ['Patients dialysés ou en chimiothérapie sans transport', 'Perte de chiffre d’affaires', 'Atteinte à la réputation'], graviteDefaut: 3, sousProfession: 'transport' },
      { description: 'Fuite de données de santé des clients ou dossiers de prise en charge', impacts: ['Violation de données de santé', 'Sanction de l’autorité de contrôle', 'Perte de confiance des clients'], graviteDefaut: 3, sousProfession: 'dm' },
      { description: 'Facturation abusive ou falsifiée de dispositifs (devis, 100 % santé, tiers payant)', impacts: ['Indus et contrôle des organismes', 'Déréférencement des réseaux', 'Atteinte à la réputation'], graviteDefaut: 3, sousProfession: 'dm' },
      { description: 'Fuite massive de données de santé depuis la plateforme (mauvaise isolation entre clients, API exposée)', impacts: ['Violation de données de santé pour de nombreux clients', 'Perte de la certification d’hébergement', 'Responsabilité contractuelle et sanctions'], graviteDefaut: 4, sousProfession: 'esante' },
      { description: 'Indisponibilité prolongée de la plateforme : consultations et accès aux dossiers interrompus', impacts: ['Continuité des soins dégradée pour les clients', 'Pénalités contractuelles', 'Perte de clients'], graviteDefaut: 3, sousProfession: 'esante' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { description: 'Altération de données médicales (allergies, traitements, résultats) pouvant conduire à une erreur de prise en charge', impacts: ['Risque pour la sécurité du patient', 'Responsabilité du médecin', 'Difficile à détecter sans journalisation'], graviteDefaut: 4, sousProfession: 'cabinet' },
      { description: 'Consultation ou copie indue de dossiers par un remplaçant ou un ancien collaborateur', impacts: ['Violation du secret médical', 'Notification de violation de données (RGPD)', 'Atteinte à la confiance des patients'], graviteDefaut: 3, sousProfession: 'cabinet' },
    ],
    sourcesRisque: [
      { nom: 'Groupe de rançongiciel ciblant les hôpitaux', categorie: 'CYBERCRIMINEL', description: 'Cybercriminels exploitant la criticité vitale des soins pour maximiser la pression au paiement', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 3, activiteScoreDefaut: 3 },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { nom: 'Groupe de rançongiciel opportuniste ciblant les petites structures de santé', categorie: 'CYBERCRIMINEL', description: 'Attaques automatisées sur des postes peu protégés, exploitant des mises à jour tardives et des sauvegardes locales', motivation: 'Lucratif', ressources: 'Moyennes', sousProfession: 'cabinet' },
      { nom: 'Réseau organisé de fraude aux prestations de santé', categorie: 'CYBERCRIMINEL', description: 'Fraudeurs usurpant des identités de professionnels ou d’assurés pour détourner des remboursements à grande échelle', motivation: 'Lucratif', ressources: 'Élevées', sousProfession: 'amo' },
      { nom: 'Groupe cherchant à revendre des données de santé de masse', categorie: 'CYBERCRIMINEL', description: 'Cybercriminels ciblant les bases d’assurés (identité, situation sociale, remboursements) pour l’hameçonnage et l’usurpation', motivation: 'Lucratif', ressources: 'Élevées', sousProfession: 'amo' },
      { nom: 'Professionnel ou adhérent complice de fraude aux remboursements', categorie: 'CYBERCRIMINEL', description: 'Acteur interne ou externe fabriquant de faux justificatifs ou de faux devis pour obtenir des prestations', motivation: 'Lucratif', ressources: 'Faibles', sousProfession: 'amc' },
      { nom: 'Groupe ciblant les plateformes de santé numérique et leurs clients', categorie: 'CYBERCRIMINEL', description: 'Attaquants exploitant une faille d’API ou d’isolation pour accéder aux données de nombreux clients à la fois', motivation: 'Lucratif', ressources: 'Élevées', sousProfession: 'esante' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { nom: 'Remplaçant, ancien collaborateur ou secrétaire (menace interne, malveillante ou négligente)', categorie: 'EMPLOYE_MALVEILLANT', description: 'Accès légitime au dossier patient utilisé par curiosité, vengeance, avantage concurrentiel ou par simple erreur', motivation: 'Curiosité / vengeance / négligence', ressources: 'Faibles', sousProfession: 'cabinet' },
    ],
    scenariosStrategiques: [
      { critere: 'D', nom: 'Arrêt du SIH par rançongiciel (D)', description: 'Un rançongiciel chiffre le SIH et bloque l’accès aux dossiers et aux plateaux techniques', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'hopital' },
      { critere: 'C', nom: 'Exfiltration de données de santé (C)', description: 'Vol puis publication de dossiers patients par un cybercriminel', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      // Aide à domicile / SAAD-SAP (issue #115)
      { critere: 'C', nom: 'Vol de tablette exposant les données des aidés (C)', description: 'La perte ou le vol d’une tablette d’intervenant expose les données des personnes accompagnées', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'saad' },
      { critere: 'D', nom: 'Rançongiciel bloquant la télégestion (D)', description: 'Un rançongiciel chiffre le logiciel de télégestion et empêche d’organiser les interventions', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'saad' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { critere: 'D', nom: 'Rançongiciel opportuniste sur le poste du cabinet (D)', description: 'Un message piégé ou une faille du poste chiffre le dossier patient et les sauvegardes locales', vraisemblanceDefaut: 4, graviteDefaut: 3, sousProfession: 'cabinet' },
      { critere: 'I', nom: 'Usurpation des moyens d’authentification du professionnel (I)', description: 'Un tiers utilise les identifiants ou la carte pour facturer ou consulter des données', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'cabinet' },
      { critere: 'I', nom: 'Fraude au virement ciblant le gestionnaire (I)', description: 'Un faux ordre ou un changement frauduleux de coordonnées détourne les paiements de plusieurs cabinets', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'gestionpro' },
      { critere: 'C', nom: 'Compromission de l’espace d’échange partagé avec les adhérents (C)', description: 'Un accès volé expose les pièces comptables, sociales et de patients de tous les adhérents', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'gestionpro' },
      { critere: 'I', nom: 'Fraude organisée aux prestations par usurpation d’identités de professionnels ou d’assurés (I)', description: 'Un réseau détourne des remboursements via de faux comptes, de fausses facturations ou des coordonnées bancaires modifiées', vraisemblanceDefaut: 4, graviteDefaut: 4, sousProfession: 'amo' },
      { critere: 'D', nom: 'Arrêt de la chaîne de liquidation par rançongiciel ou attaque d’un prestataire (D)', description: 'Le chiffrement des systèmes centraux ou d’un éditeur empêche les remboursements pendant plusieurs jours', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'amo' },
      { critere: 'C', nom: 'Exfiltration de données de santé des adhérents via un prestataire de gestion (C)', description: 'Un délégataire de gestion ou un sous-traitant est compromis et expose les dossiers de remboursement', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'amc' },
      { critere: 'I', nom: 'Fraude aux remboursements par faux justificatifs ou devis (I)', description: 'Des adhérents ou des professionnels complices obtiennent des prestations indues', vraisemblanceDefaut: 4, graviteDefaut: 2, sousProfession: 'amc' },
      { critere: 'D', nom: 'Saturation ou panne de la plateforme de droits en temps réel (D)', description: 'Une attaque par déni de service ou une défaillance technique empêche les vérifications de droits des professionnels', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'tierspayant' },
      { critere: 'I', nom: 'Falsification des flux de facturation ou des tarifs (I)', description: 'Un attaquant ou un initié modifie les montants ou bénéficiaires dans les échanges entre professionnels et organismes', vraisemblanceDefaut: 2, graviteDefaut: 4, sousProfession: 'tierspayant' },
      { critere: 'D', nom: 'Rançongiciel sur le SGL et les automates (D)', description: 'Le chiffrement du SGL arrête la validation et la transmission des résultats', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'labo' },
      { critere: 'I', nom: 'Manipulation de résultats ou d’identifications d’échantillons (I)', description: 'Une intrusion ou une erreur d’interface modifie des résultats avant leur transmission', vraisemblanceDefaut: 2, graviteDefaut: 4, sousProfession: 'labo' },
      { critere: 'D', nom: 'Rançongiciel sur le logiciel d’officine et sa sauvegarde (D)', description: 'Le chiffrement du LGO et des sauvegardes locales stoppe la délivrance et la facturation', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'officine' },
      { critere: 'I', nom: 'Usurpation de l’identité de l’officine pour une facturation frauduleuse (I)', description: 'Un tiers utilise les identifiants ou la carte pour facturer des produits non délivrés', vraisemblanceDefaut: 2, graviteDefaut: 3, sousProfession: 'officine' },
      { critere: 'D', nom: 'Arrêt du PACS ou des équipements par une attaque (D)', description: 'Un rançongiciel ou un accès distant du fabricant compromis arrête l’imagerie et les traitements', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'imagerie' },
      { critere: 'C', nom: 'Exfiltration d’images et de comptes rendus (C)', description: 'Un serveur d’images exposé sur Internet est exploité pour copier des examens', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'imagerie' },
      { critere: 'I', nom: 'Falsification de bons de transport ou facturation fictive (I)', description: 'Des prescriptions ou des trajets sont falsifiés pour obtenir des remboursements indus', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'transport' },
      { critere: 'D', nom: 'Rançongiciel sur la régulation et les terminaux embarqués (D)', description: 'Le chiffrement du logiciel de régulation arrête la prise en charge des patients', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'transport' },
      { critere: 'C', nom: 'Exfiltration des données de santé de la clientèle (C)', description: 'Un accès volé au logiciel de magasin expose ordonnances, corrections et remboursements', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'dm' },
      { critere: 'I', nom: 'Fraude à la prise en charge (devis gonflés, produits non délivrés) (I)', description: 'Des facturations falsifiées sont transmises aux organismes obligatoires et complémentaires', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'dm' },
      { critere: 'C', nom: 'Exfiltration de données de santé via une API ou un compte client compromis (C)', description: 'Une faille d’isolation ou une clé d’API volée donne accès aux données de plusieurs clients', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'esante' },
      { critere: 'D', nom: 'Indisponibilité prolongée de la plateforme hébergée (D)', description: 'Un incident chez l’hébergeur ou un rançongiciel interrompt les services des établissements clients', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'esante' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { critere: 'C', nom: 'Compromission de l’éditeur du logiciel de cabinet exposant les dossiers de nombreux cabinets (C)', description: 'Un accès de maintenance ou une faille de l’éditeur ou de son hébergeur permet d’exfiltrer les bases de tous ses clients, dont le cabinet', vraisemblanceDefaut: 2, graviteDefaut: 4, sousProfession: 'cabinet' },
      { critere: 'I', nom: 'Abus d’accès par un remplaçant ou un compte non révoqué (I)', description: 'Un remplaçant ou ancien collaborateur utilise un compte partagé ou resté actif pour consulter, copier ou falsifier des dossiers et facturer à tort', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'cabinet' },
    ],
    // Autorités sectorielles santé (NIS2 : ANS autorité compétente) — issue #81
    partiesPrenantes: [
      { nom: 'Agence du Numérique en Santé (ANS)', type: 'ORGANISME_REGULATION', dependance: 2, penetration: 1, maturite: 4, confiance: 4 },
      { nom: 'CERT Santé (ANS)', type: 'ORGANISME_REGULATION', dependance: 2, penetration: 1, maturite: 4, confiance: 4 },
      { nom: 'Agence Régionale de Santé (ARS)', type: 'ORGANISME_REGULATION', dependance: 2, penetration: 1, maturite: 3, confiance: 4 },
      { nom: 'Hébergeur de données de santé (HDS)', type: 'FOURNISSEUR', dependance: 4, penetration: 3, maturite: 4, confiance: 3 },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)
      { nom: 'Éditeur du logiciel de gestion de cabinet', type: 'FOURNISSEUR', dependance: 4, penetration: 3, maturite: 3, confiance: 3, sousProfession: 'cabinet' },
      { nom: 'Assurance Maladie (organisme de remboursement)', type: 'CLIENT', dependance: 3, penetration: 2, maturite: 4, confiance: 4, sousProfession: 'cabinet' },
      { nom: 'Prestataire d’hébergement et de messagerie du gestionnaire', type: 'FOURNISSEUR', dependance: 4, penetration: 3, maturite: 3, confiance: 3, sousProfession: 'gestionpro' },
      { nom: 'Éditeurs et opérateurs de la chaîne de liquidation', type: 'FOURNISSEUR', dependance: 4, penetration: 4, maturite: 3, confiance: 3, sousProfession: 'amo' },
      { nom: 'Professionnels de santé facturant l’Assurance Maladie', type: 'CLIENT', dependance: 3, penetration: 4, maturite: 2, confiance: 3, sousProfession: 'amo' },
      { nom: 'Délégataires de gestion et prestataires de tiers payant', type: 'FOURNISSEUR', dependance: 4, penetration: 4, maturite: 3, confiance: 3, sousProfession: 'amc' },
      { nom: 'Pharmacies, opticiens et établissements raccordés', type: 'CLIENT', dependance: 4, penetration: 4, maturite: 2, confiance: 3, sousProfession: 'tierspayant' },
      { nom: 'Fabricants d’automates et éditeur du SGL', type: 'FOURNISSEUR', dependance: 4, penetration: 3, maturite: 3, confiance: 3, sousProfession: 'labo' },
      { nom: 'Éditeur du logiciel d’officine et grossistes-répartiteurs', type: 'FOURNISSEUR', dependance: 4, penetration: 3, maturite: 3, confiance: 3, sousProfession: 'officine' },
      { nom: 'Fabricants d’équipements et prestataires de maintenance à distance', type: 'FOURNISSEUR', dependance: 4, penetration: 4, maturite: 3, confiance: 3, sousProfession: 'imagerie' },
      { nom: 'Éditeur de logiciel de régulation et opérateur de géolocalisation', type: 'FOURNISSEUR', dependance: 4, penetration: 3, maturite: 3, confiance: 3, sousProfession: 'transport' },
      { nom: 'Éditeur du logiciel de magasin et plateforme de télétransmission', type: 'FOURNISSEUR', dependance: 4, penetration: 3, maturite: 3, confiance: 3, sousProfession: 'dm' },
      { nom: 'Hébergeur de données de santé et fournisseurs cloud', type: 'FOURNISSEUR', dependance: 4, penetration: 4, maturite: 4, confiance: 3, sousProfession: 'esante' },
      // Assurance maladie et écosystème de santé — sous-secteurs santé détaillés (sousProfession)

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
      { nom: 'Exécution des paiements et virements', type: 'PROCESSUS', description: 'Traitement des ordres de paiement, virements SEPA et SWIFT', responsable: 'Direction des opérations / back-office', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'banque' },
      { nom: 'Core banking (tenue des comptes)', type: 'INFORMATION', description: 'Soldes, opérations et référentiel clients du système central', responsable: 'DSI / Direction des systèmes d’information', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'banque' },
      { nom: 'Octroi de crédit et scoring', type: 'PROCESSUS', description: 'Évaluation du risque et décision d’octroi de crédit', responsable: 'Direction des risques crédit', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'banque' },
      { nom: 'Lutte anti-fraude et conformité (LCB-FT)', type: 'PROCESSUS', description: 'Détection de fraude, blanchiment et financement du terrorisme', responsable: 'Direction de la conformité (LCB-FT)', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      // Assurance (issue #111) — sousProfession 'assurance'
      { nom: 'Gestion des sinistres', type: 'PROCESSUS', description: 'Déclaration, expertise, provisionnement et indemnisation des sinistres', responsable: 'Direction indemnisation / gestion des sinistres', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'assurance' },
      { nom: 'Données des assurés (dont données de santé)', type: 'INFORMATION', description: 'Données personnelles et de santé des assurés (complémentaire santé, prévoyance) — RGPD art. 9', responsable: 'DPO / Direction technique', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'assurance' },
      { nom: 'Tarification et modèles actuariels', type: 'PROCESSUS', description: 'Tarification, provisionnement et modèles actuariels (qualité des données soulignée par l’ACPR)', responsable: 'Direction actuariat', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'assurance' },
      { nom: 'Souscription et gestion des contrats', type: 'PROCESSUS', description: 'Souscription, émission et gestion des polices et avenants', responsable: 'Direction souscription', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'assurance' },
    ],
    biensSupports: [
      { nom: 'Plateforme core banking', type: 'LOGICIEL', description: 'Progiciel central de tenue des comptes et des opérations', sousProfession: 'banque' },
      { nom: 'Passerelle SWIFT', type: 'RESEAU', description: 'Connexion au réseau interbancaire international de paiement', sousProfession: 'banque' },
      { nom: 'Application de banque en ligne / mobile', type: 'LOGICIEL', description: 'Canaux digitaux d’accès des clients à leurs comptes', sousProfession: 'banque' },
      { nom: 'Distributeurs automatiques (DAB / GAB)', type: 'MATERIEL', description: 'Terminaux de retrait et de dépôt en agence et hors site', sousProfession: 'banque' },
      // KYC/KYB — socle LCB-FT (issue #69) — commun banque/assurance
      { nom: 'Solution de vérification d’identité (KYC / KYB)', type: 'SOUS_TRAITANCE', description: 'Contrôle d’identité et de connaissance client/entreprise (Onfido, Jumio, Sumsub) — socle LCB-FT' },
      // Assurance (issue #111)
      { nom: 'Plateforme de gestion des contrats et sinistres', type: 'LOGICIEL', description: 'Progiciel métier d’émission des polices et de gestion des sinistres', sousProfession: 'assurance' },
      { nom: 'Outil actuariel et de tarification', type: 'LOGICIEL', description: 'Moteur de tarification, provisionnement et modèles actuariels', sousProfession: 'assurance' },
    ],
    evenementsRedoutes: [
      { description: 'Détournement de virements ou fraude sur les paiements', impacts: ['Perte financière directe', 'Sanction réglementaire (DORA / ACPR)', 'Atteinte à la réputation'], graviteDefaut: 4, sousProfession: 'banque' },
      { description: 'Indisponibilité de la banque en ligne et des paiements', impacts: ['Clients privés d’accès à leurs fonds', 'Sanction du régulateur', 'Perte de confiance'], graviteDefaut: 4, sousProfession: 'banque' },
      { description: 'Fuite des données bancaires et personnelles des clients', impacts: ['Usurpation d’identité', 'Sanction RGPD', 'Préjudice client'], graviteDefaut: 4 },
      // Fraude à l'identité / prêt frauduleux (issue #69)
      { description: 'Usurpation d’identité pour un prêt frauduleux', impacts: ['Octroi de crédit à un fraudeur', 'Perte financière', 'Manquement LCB-FT / signalement TRACFIN'], graviteDefaut: 4, sousProfession: 'banque' },
      // Assurance (issue #111)
      { description: 'Fuite des données de santé des assurés', impacts: ['Violation de données sensibles (RGPD art. 9)', 'Sanction CNIL', 'Préjudice grave pour les assurés'], graviteDefaut: 4, sousProfession: 'assurance' },
      { description: 'Fraude à l’assurance (faux sinistres)', impacts: ['Indemnisations indues', 'Perte financière', 'Dégradation du ratio sinistres/primes'], graviteDefaut: 3, sousProfession: 'assurance' },
    ],
    sourcesRisque: [
      { nom: 'Groupe spécialisé en fraude bancaire (type Carbanak)', categorie: 'CYBERCRIMINEL', description: 'Cybercriminels organisés ciblant les systèmes de paiement et SWIFT', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 3, activiteScoreDefaut: 3, sousProfession: 'banque' },
      { nom: 'Fraudeur à l’identité (contournement KYC)', categorie: 'CYBERCRIMINEL', description: 'Fraudeur usurpant une identité (deepfake, faux documents) pour contourner le KYC et souscrire des produits', motivation: 'Lucratif', ressources: 'Moyennes', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 2, activiteScoreDefaut: 4 },
      // Assurance (issue #111)
      { nom: 'Réseau de fraude à l’assurance', categorie: 'CYBERCRIMINEL', description: 'Fraudeurs organisés déclarant de faux sinistres ou manipulant les dossiers d’indemnisation', motivation: 'Lucratif', ressources: 'Moyennes', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 2, activiteScoreDefaut: 3, sousProfession: 'assurance' },
    ],
    scenariosStrategiques: [
      { critere: 'I', nom: 'Manipulation frauduleuse des virements (I)', description: 'Un attaquant détourne des ordres de paiement via la passerelle SWIFT', vraisemblanceDefaut: 2, graviteDefaut: 4, sousProfession: 'banque' },
      { critere: 'D', nom: 'Indisponibilité des services de paiement (D)', description: 'Attaque rendant indisponibles la banque en ligne et les paiements', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'banque' },
      { critere: 'I', nom: 'Contournement du KYC pour un prêt frauduleux (I)', description: 'Un fraudeur déjoue la vérification d’identité (deepfake) pour souscrire un crédit', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'banque' },
      // Assurance (issue #111)
      { critere: 'C', nom: 'Exfiltration des données de santé des assurés (C)', description: 'Un attaquant exfiltre la base des données de santé des assurés (complémentaire santé)', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'assurance' },
      { critere: 'I', nom: 'Fraude aux sinistres par manipulation du SI (I)', description: 'Manipulation des dossiers de sinistres pour déclencher des indemnisations indues', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'assurance' },
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
      // Énergies renouvelables (issue #95)
      { nom: 'Production d’énergie renouvelable (éolien / solaire)', type: 'PROCESSUS', description: 'Pilotage des parcs éoliens et photovoltaïques et injection sur le réseau électrique', responsable: 'Direction de l’exploitation ENR', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
      // Pharma / chimie (issue #113) — sousProfession 'pharma'
      { nom: 'Fabrication pharmaceutique (BPF / dossier de lot)', type: 'PROCESSUS', description: 'Production sous bonnes pratiques de fabrication ; enregistrement électronique des dossiers de lot (intégrité GxP / 21 CFR Part 11)', responsable: 'Direction industrielle / assurance qualité', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4, sousProfession: 'pharma' },
      { nom: 'Données d’essais cliniques', type: 'INFORMATION', description: 'Données des essais cliniques et des patients (confidentialité, exigences FDA / EMA)', responsable: 'Direction des affaires réglementaires / R&D', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'pharma' },
      { nom: 'Formules, brevets et propriété intellectuelle', type: 'INFORMATION', description: 'Formulations, procédés de synthèse et brevets — cibles d’espionnage industriel', responsable: 'Direction R&D / propriété industrielle', disponibilite: 2, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'pharma' },
    ],
    biensSupports: [
      { nom: 'Automates programmables (PLC)', type: 'MATERIEL', description: 'Contrôleurs pilotant les équipements de production' },
      { nom: 'Système SCADA / poste de supervision', type: 'LOGICIEL', description: 'Supervision et commande centralisée du procédé industriel' },
      { nom: 'Réseau OT / bus de terrain', type: 'RESEAU', description: 'Réseau industriel reliant capteurs, automates et supervision' },
      { nom: 'Accès de télémaintenance fournisseur', type: 'SOUS_TRAITANCE', description: 'Connexion distante d’un fournisseur pour la maintenance des équipements' },
      { nom: 'Logiciel d’ingénierie automate (Siemens STEP 7, Schneider Unity Pro)', type: 'LOGICIEL', description: 'Poste d’ingénierie de programmation et de configuration des automates' },
      // Énergies renouvelables (issue #95)
      { nom: 'Télésupervision des parcs ENR (SCADA distribué)', type: 'LOGICIEL', description: 'Supervision à distance des éoliennes et onduleurs photovoltaïques répartis sur le territoire' },
      { nom: 'Système de stockage par batteries (BESS)', type: 'MATERIEL', description: 'Batteries de stockage et leur système de gestion (BMS / EMS)' },
      // Pharma / chimie (issue #113)
      { nom: 'LIMS (système de gestion de laboratoire)', type: 'LOGICIEL', description: 'Gestion des analyses, échantillons et résultats de contrôle qualité', sousProfession: 'pharma' },
      { nom: 'MES / SCADA de production GMP', type: 'LOGICIEL', description: 'Exécution et supervision de la production sous bonnes pratiques de fabrication', sousProfession: 'pharma' },
      { nom: 'Supervision de la chaîne du froid (GTB / BMS)', type: 'MATERIEL', description: 'Surveillance des températures des entrepôts et unités réfrigérées', sousProfession: 'pharma' },
    ],
    evenementsRedoutes: [
      { description: 'Arrêt ou sabotage de la production industrielle', impacts: ['Perte de production', 'Atteinte à la sécurité des personnes', 'Dommages matériels'], graviteDefaut: 4 },
      { description: 'Altération des consignes de procédé (SCADA / automates)', impacts: ['Accident industriel', 'Atteinte à l’environnement', 'Risque pour les opérateurs'], graviteDefaut: 4 },
      { description: 'Compromission via un accès de télémaintenance', impacts: ['Prise de contrôle des installations', 'Propagation IT → OT'], graviteDefaut: 3 },
      // Énergies renouvelables (issue #95)
      { description: 'Déconnexion ou pilotage malveillant d’un parc ENR', impacts: ['Perte de production injectée', 'Déstabilisation du réseau électrique', 'Pertes financières'], graviteDefaut: 4 },
      // Pharma / chimie (issue #113)
      { description: 'Falsification d’un dossier de lot (intégrité GxP)', impacts: ['Libération d’un lot non conforme', 'Rappel de produits / sanction FDA-EMA', 'Risque pour les patients'], graviteDefaut: 4, sousProfession: 'pharma' },
      { description: 'Fuite de données d’essais cliniques ou de brevets', impacts: ['Perte d’avantage concurrentiel', 'Atteinte à la confidentialité des patients', 'Sanction RGPD'], graviteDefaut: 4, sousProfession: 'pharma' },
    ],
    sourcesRisque: [
      { nom: 'Acteur étatique ciblant les infrastructures (type Sandworm)', categorie: 'ETAT_NATION', description: 'Attaquant étatique cherchant à perturber ou saboter des systèmes industriels critiques', motivation: 'Déstabilisation / sabotage', ressources: 'Très élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 4, activiteScoreDefaut: 3 },
      // Pharma / chimie (issue #113)
      { nom: 'Concurrent / espion industriel (contrefaçon, brevets)', categorie: 'CONCURRENT', description: 'Acteur cherchant à dérober formules, procédés et données cliniques', motivation: 'Espionnage industriel', ressources: 'Élevées', pertinenceDefaut: 3, motivationScoreDefaut: 3, ressourcesScoreDefaut: 3, activiteScoreDefaut: 2, sousProfession: 'pharma' },
    ],
    scenariosStrategiques: [
      { critere: 'D', nom: 'Sabotage de la production via le réseau OT (D)', description: 'Un attaquant atteint les automates et arrête les installations', vraisemblanceDefaut: 2, graviteDefaut: 4 },
      { critere: 'I', nom: 'Altération des consignes de procédé (I)', description: 'Modification malveillante des paramètres SCADA provoquant un incident', vraisemblanceDefaut: 2, graviteDefaut: 4 },
      // Énergies renouvelables (issue #95)
      { critere: 'D', nom: 'Prise de contrôle d’un parc ENR via le SCADA distribué (D)', description: 'Un attaquant compromet la télésupervision pour déconnecter ou dérégler les éoliennes / onduleurs PV', vraisemblanceDefaut: 2, graviteDefaut: 4 },
      // Pharma / chimie (issue #113)
      { critere: 'D', nom: 'Rançongiciel bloquant la libération des lots (D)', description: 'Un rançongiciel chiffre le MES / LIMS et interrompt le contrôle qualité et la libération des lots', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'pharma' },
      { critere: 'C', nom: 'Exfiltration de données cliniques et de brevets (C)', description: 'Un attaquant exfiltre les données d’essais cliniques et la propriété intellectuelle', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'pharma' },
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
      { nom: 'Suite collaborative de l’État (Tchap, Resana, Osmose)', type: 'LOGICIEL', description: 'Messagerie et espaces de travail collaboratifs souverains de l’administration' },
    ],
    evenementsRedoutes: [
      { description: 'Indisponibilité des services publics numériques', impacts: ['Usagers privés de démarches essentielles', 'Continuité du service public rompue'], graviteDefaut: 3 },
      { description: 'Fuite ou altération des données des administrés', impacts: ['Atteinte à la vie privée', 'Sanction RGPD', 'Perte de confiance des citoyens'], graviteDefaut: 4 },
      { description: 'Défiguration ou désinformation sur les canaux officiels', impacts: ['Atteinte à l’image de l’institution', 'Diffusion de fausses informations'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Hacktiviste visant l’institution publique', categorie: 'ACTIVISTE', description: 'Acteur idéologique cherchant à défigurer les sites ou divulguer des données pour porter un message politique', motivation: 'Idéologique', ressources: 'Moyennes', pertinenceDefaut: 2, motivationScoreDefaut: 3, ressourcesScoreDefaut: 2, activiteScoreDefaut: 3 },
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
      { nom: 'Système de gestion du transport (TMS)', type: 'LOGICIEL', description: 'Planification, optimisation et suivi des transports et tournées', sousProfession: 'logistique' },
      { nom: 'Chronotachygraphe numérique', type: 'MATERIEL', description: 'Enregistrement réglementaire des temps de conduite et de repos', sousProfession: 'logistique' },
      { nom: 'Échanges de données informatisées (EDI)', type: 'RESEAU', description: 'Interfaces d’échange avec clients, transporteurs et douanes' },
      // Modes spécifiques (issue #97)
      { nom: 'Signalisation ferroviaire (ERTMS / ETCS)', type: 'MATERIEL', description: 'Systèmes de signalisation et de contrôle-commande des circulations ferroviaires', sousProfession: 'ferroviaire' },
      { nom: 'Systèmes aéroportuaires et gestion du trafic aérien', type: 'LOGICIEL', description: 'Systèmes d’exploitation aéroportuaire et d’aide à la gestion du trafic aérien', sousProfession: 'aerien' },
      { nom: 'Systèmes de navire et portuaires (ECDIS / AIS)', type: 'MATERIEL', description: 'Systèmes de navigation, d’identification (AIS) et de gestion portuaire', sousProfession: 'maritime' },
    ],
    evenementsRedoutes: [
      { description: 'Interruption de l’exploitation et des livraisons', impacts: ['Retards et ruptures d’approvisionnement', 'Perte de chiffre d’affaires', 'Atteinte aux engagements clients'], graviteDefaut: 4 },
      { description: 'Altération des données de suivi ou de régulation', impacts: ['Erreurs d’acheminement', 'Incident d’exploitation', 'Atteinte à la sécurité'], graviteDefaut: 4 },
      { description: 'Fuite de données voyageurs / clients', impacts: ['Atteinte à la vie privée', 'Sanction RGPD', 'Perte de confiance'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Cybercriminel ciblant la chaîne logistique', categorie: 'CYBERCRIMINEL', description: 'Cybercriminels visant les opérateurs logistiques pour rançon ou détournement de marchandises', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 3, activiteScoreDefaut: 3 },
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
      { nom: 'Acteur étatique d’espionnage des communications', categorie: 'ETAT_NATION', description: 'Attaquant étatique cherchant à intercepter ou perturber les communications', motivation: 'Renseignement', ressources: 'Très élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 4, activiteScoreDefaut: 3 },
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
      { nom: 'Acteur d’espionnage académique et scientifique', categorie: 'ETAT_NATION', description: 'Attaquant cherchant à dérober des travaux de recherche sensibles', motivation: 'Espionnage', ressources: 'Élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 4, activiteScoreDefaut: 3 },
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
      { nom: 'Solution e-commerce SaaS (Shopify, WooCommerce, PrestaShop)', type: 'SOUS_TRAITANCE', description: 'Plateforme marchande hébergée en SaaS et ses extensions' },
      { nom: 'Prestataire de paiement (Stripe, PayPal)', type: 'SOUS_TRAITANCE', description: 'Service tiers de traitement des paiements en ligne' },
    ],
    evenementsRedoutes: [
      { description: 'Indisponibilité du site marchand / des caisses', impacts: ['Perte de chiffre d’affaires', 'Atteinte à l’image', 'Clients mécontents'], graviteDefaut: 4 },
      { description: 'Vol de données de cartes de paiement', impacts: ['Fraude à la carte bancaire', 'Sanction PCI-DSS', 'Atteinte à la réputation'], graviteDefaut: 4 },
      { description: 'Fuite de la base de données clients', impacts: ['Atteinte à la vie privée', 'Sanction RGPD', 'Perte de confiance'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Groupe de vol de données de paiement (Magecart)', categorie: 'CYBERCRIMINEL', description: 'Cybercriminels ciblant les sites marchands et caisses pour voler des données de paiement', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 3, activiteScoreDefaut: 3 },
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
      { nom: 'Gestion des dossiers clients', type: 'PROCESSUS', description: 'Suivi des affaires, pièces et échéances des dossiers clients', responsable: 'Associé / responsable du dossier', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Correspondances et secret professionnel', type: 'INFORMATION', description: 'Échanges confidentiels avec les clients couverts par le secret professionnel', responsable: 'Associé / responsable du dossier', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Maniement de fonds clients (CARPA)', type: 'PROCESSUS', description: 'Gestion des fonds des clients via la CARPA', responsable: 'Direction financière du cabinet', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'avocat' },
      { nom: 'Dossiers sensibles (M&A, contentieux)', type: 'INFORMATION', description: 'Données confidentielles d’opérations M&A, due diligence et contentieux', responsable: 'Associé en charge du dossier', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3, sousProfession: 'avocat' },
      // ── Notaires (indices 4+ : ne pas réinsérer avant, i18n indexée) ──
      { nom: 'Rédaction et conservation des actes authentiques', type: 'PROCESSUS', description: 'Établissement, signature électronique et conservation des actes authentiques (ventes, successions, donations)', responsable: 'Notaire / clerc rédacteur', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'notaire' },
      { nom: 'Maniement des fonds de l’étude (compte CDC)', type: 'PROCESSUS', description: 'Réception et reversement des fonds des clients (prix de vente, droits) via le compte unique à la Caisse des Dépôts', responsable: 'Comptabilité de l’étude', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'notaire' },
      { nom: 'Données patrimoniales des clients', type: 'INFORMATION', description: 'Successions, donations, régimes matrimoniaux et état civil des parties', responsable: 'Notaire en charge du dossier', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4, sousProfession: 'notaire' },
    ],
    biensSupports: [
      { nom: 'Logiciel de gestion de cabinet', type: 'LOGICIEL', description: 'Application métier de gestion des dossiers, du temps et de la facturation' },
      { nom: 'Coffre-fort électronique / GED', type: 'LOGICIEL', description: 'Stockage sécurisé et archivage des actes et pièces' },
      { nom: 'Plateformes e-procédure (RPVA, Télérecours)', type: 'RESEAU', description: 'Accès aux juridictions et dépôt dématérialisé des actes', sousProfession: 'avocat' },
      { nom: 'Data room sécurisée', type: 'SOUS_TRAITANCE', description: 'Espace cloud de partage de pièces pour les opérations sensibles' },
      // ── Notaires ──
      { nom: 'Plateforme notariale (RÉAL / Télé@ctes)', type: 'RESEAU', description: 'Réseau et téléservices du notariat (publicité foncière, échanges interprofessionnels)', sousProfession: 'notaire' },
      { nom: 'Logiciel de rédaction d’actes (Genapi, iNot, Fiducial Comnot)', type: 'LOGICIEL', description: 'Application notariale de rédaction et de gestion des actes', sousProfession: 'notaire' },
      { nom: 'Coffre-fort des actes authentiques électroniques (MICEN)', type: 'SOUS_TRAITANCE', description: 'Minutier central électronique des notaires hébergeant les actes authentiques', sousProfession: 'notaire' },
    ],
    evenementsRedoutes: [
      { description: 'Divulgation de pièces couvertes par le secret professionnel', impacts: ['Violation du secret professionnel', 'Sanction déontologique', 'Préjudice grave au client'], graviteDefaut: 4 },
      { description: 'Indisponibilité des dossiers et de l’e-procédure', impacts: ['Forclusion / délais procéduraux manqués', 'Interruption de l’activité du cabinet'], graviteDefaut: 4 },
      { description: 'Détournement de fonds clients (CARPA)', impacts: ['Perte financière pour les clients', 'Sanction de l’Ordre', 'Atteinte à la réputation'], graviteDefaut: 4, sousProfession: 'avocat' },
      // ── Notaires ──
      { description: 'Détournement d’un virement de prix de vente immobilière', impacts: ['Perte du prix de vente (100 000–500 000 €)', 'Mise en cause de la responsabilité civile du notaire', 'Atteinte à la confiance'], graviteDefaut: 4, sousProfession: 'notaire' },
    ],
    sourcesRisque: [
      { nom: 'Cybercriminel ciblant les professions du droit', categorie: 'CYBERCRIMINEL', description: 'Attaquants visant les données confidentielles et les fonds des cabinets et études (rançongiciel, fraude au virement)', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 3, activiteScoreDefaut: 3 },
      // ── Notaires ──
      { nom: 'Escroc au faux ordre de virement (BEC)', categorie: 'CYBERCRIMINEL', description: 'Fraudeur usurpant l’identité d’une partie ou de l’étude pour détourner un virement lors d’une vente immobilière', motivation: 'Lucratif', ressources: 'Moyennes', pertinenceDefaut: 4, motivationScoreDefaut: 4, ressourcesScoreDefaut: 2, activiteScoreDefaut: 4, sousProfession: 'notaire' },
    ],
    scenariosStrategiques: [
      { critere: 'C', nom: 'Fuite de dossiers confidentiels clients (C)', description: 'Exfiltration de pièces couvertes par le secret professionnel par un cybercriminel', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'D', nom: 'Blocage du cabinet par rançongiciel (D)', description: 'Un rançongiciel chiffre les dossiers et bloque l’accès aux téléservices', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      // ── Notaires ──
      { critere: 'I', nom: 'Fraude au virement immobilier (BEC) (I)', description: 'Un escroc s’interpose dans les échanges et substitue un faux RIB pour détourner le virement du prix de vente', vraisemblanceDefaut: 4, graviteDefaut: 4, sousProfession: 'notaire' },
      { critere: 'C', nom: 'Usurpation de l’identité de l’étude (C)', description: 'Compromission d’une messagerie de l’étude pour adresser de fausses instructions de virement aux clients', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'notaire' },
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
      { nom: 'Attaquant ciblant la chaîne d’approvisionnement logicielle', categorie: 'CYBERCRIMINEL', description: 'Acteur compromettant une dépendance, un build ou un registre pour atteindre les clients en aval', motivation: 'Lucratif / sabotage', ressources: 'Élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 3, activiteScoreDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'I', nom: 'Injection de code via le pipeline CI/CD (I)', description: 'Un attaquant compromet le pipeline et injecte du code malveillant en production', vraisemblanceDefaut: 2, graviteDefaut: 4 },
      { critere: 'C', nom: 'Exfiltration de données clients via secrets fuités (C)', description: 'Des secrets exposés permettent l’accès et l’exfiltration des données clients', vraisemblanceDefaut: 3, graviteDefaut: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// AGROALIMENTAIRE / AGRICULTURE (IAA) — production, chaîne du froid, traçabilité (issue #89)
// ─────────────────────────────────────────────────────────────────────────────
const AGRI: SectorFamily = {
  key: 'agri',
  match: ['agricol', 'agro', 'agriculture', 'agroaliment', 'élevage', 'elevage', 'ferme', 'alimentaire', 'food', 'farming'],
  exemples: {
    valeursMetier: [
      { nom: 'Production et transformation alimentaire', type: 'PROCESSUS', description: 'Lignes de fabrication, cuisson, conditionnement des produits alimentaires', responsable: 'Direction de production', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Maîtrise de la chaîne du froid', type: 'PROCESSUS', description: 'Contrôle des températures de conservation, condition de la sécurité sanitaire des denrées', responsable: 'Responsable qualité / logistique', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Recettes et formulations', type: 'INFORMATION', description: 'Formules, procédés et savoir-faire de production (propriété industrielle)', responsable: 'R&D / direction industrielle', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3 },
      { nom: 'Traçabilité sanitaire des lots', type: 'INFORMATION', description: 'Traçabilité amont/aval des lots, obligations HACCP et gestion des rappels produits', responsable: 'Direction qualité', disponibilite: 3, integrite: 4, confidentialite: 2, tracabilite: 4 },
    ],
    biensSupports: [
      { nom: 'Automates et supervision de production (SCADA)', type: 'MATERIEL', description: 'Automates (PLC), supervision et capteurs des lignes de production' },
      { nom: 'Supervision de la chaîne du froid', type: 'LOGICIEL', description: 'Pilotage des températures des chambres froides et de la logistique frigorifique' },
      { nom: 'ERP / MES agroalimentaire', type: 'LOGICIEL', description: 'Gestion de production, des lots et de la traçabilité' },
      { nom: 'Prestataire de transport frigorifique', type: 'SOUS_TRAITANCE', description: 'Transport et entreposage sous température dirigée' },
    ],
    evenementsRedoutes: [
      { description: 'Arrêt des lignes de production par cyberattaque', impacts: ['Perte de production et de denrées périssables', 'Rupture d’approvisionnement', 'Pertes financières'], graviteDefaut: 4 },
      { description: 'Rupture de la chaîne du froid', impacts: ['Risque sanitaire pour le consommateur', 'Rappel de produits', 'Perte de lots'], graviteDefaut: 4 },
      { description: 'Altération des recettes ou des dosages', impacts: ['Contamination / non-conformité', 'Risque sanitaire', 'Rappel de produits'], graviteDefaut: 4 },
    ],
    sourcesRisque: [
      { nom: 'Rançongiciel ciblant l’agroalimentaire', categorie: 'CYBERCRIMINEL', description: 'Attaquants exploitant la criticité de la production et le caractère périssable des denrées pour maximiser la pression', motivation: 'Lucratif', ressources: 'Élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 3, activiteScoreDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'D', nom: 'Arrêt de production par rançongiciel (D)', description: 'Un rançongiciel chiffre le MES/SCADA et bloque les lignes de production', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'I', nom: 'Sabotage des paramètres de production (I)', description: 'Un attaquant modifie les paramètres (température, dosage) compromettant la sécurité sanitaire', vraisemblanceDefaut: 2, graviteDefaut: 4 },
    ],
  },
}

// ─── DÉFENSE / SÉCURITÉ NATIONALE (issue #83) ────────────────────────────────
const DEFENSE: SectorFamily = {
  key: 'defense',
  match: ['défense', 'defense', 'militaire', 'armement', 'bitd', 'sécurité nationale', 'securite nationale', 'defence', 'army'],
  exemples: {
    valeursMetier: [
      { nom: 'Informations classifiées de défense', type: 'INFORMATION', description: 'Données classifiées (Diffusion Restreinte, Secret) relatives aux programmes et opérations', responsable: 'Officier de sécurité', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Programmes et systèmes d’armes', type: 'PROCESSUS', description: 'Conception, développement et maintien en condition opérationnelle des systèmes de défense', responsable: 'Direction des programmes', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 3 },
      { nom: 'Chaîne d’approvisionnement de défense', type: 'PROCESSUS', description: 'Approvisionnement en composants et équipements critiques auprès de la BITD', responsable: 'Direction des achats', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 3 },
    ],
    biensSupports: [
      { nom: 'Réseau homologué / SI de souveraineté', type: 'RESEAU', description: 'Réseau homologué au traitement d’informations classifiées de défense' },
      { nom: 'Systèmes embarqués et systèmes d’armes', type: 'MATERIEL', description: 'Calculateurs et logiciels embarqués des équipements militaires' },
      { nom: 'Prestataire de la BITD', type: 'SOUS_TRAITANCE', description: 'Sous-traitant de la base industrielle et technologique de défense' },
    ],
    evenementsRedoutes: [
      { description: 'Exfiltration d’informations classifiées de défense', impacts: ['Atteinte à la souveraineté nationale', 'Avantage à un État adverse', 'Sanctions pénales'], graviteDefaut: 4 },
      { description: 'Compromission d’un système d’armes', impacts: ['Perte de capacité opérationnelle', 'Risque pour la sécurité des forces'], graviteDefaut: 4 },
    ],
    sourcesRisque: [
      { nom: 'Acteur étatique de cyberespionnage (APT)', categorie: 'ETAT_NATION', description: 'Acteur étatique ciblant les secrets de défense et la BITD', motivation: 'Espionnage / souveraineté', ressources: 'Très élevées', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 4, activiteScoreDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'C', nom: 'Exfiltration de secrets de défense par un APT (C)', description: 'Un acteur étatique s’implante durablement pour exfiltrer des informations classifiées', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'I', nom: 'Sabotage d’un système d’armes via la supply chain (I)', description: 'Compromission d’un composant de la chaîne d’approvisionnement d’un système d’armes', vraisemblanceDefaut: 2, graviteDefaut: 4 },
    ],
  },
}

// ─── IMMOBILIER / CONSTRUCTION (issue #83) ───────────────────────────────────
const IMMOBILIER: SectorFamily = {
  key: 'immobilier',
  match: ['immobilier', 'construction', 'bâtiment', 'batiment', 'btp', 'promoteur', 'real estate', 'foncier', 'syndic'],
  exemples: {
    valeursMetier: [
      { nom: 'Gestion locative et transactions', type: 'PROCESSUS', description: 'Baux, mandats, transactions et états des lieux', responsable: 'Direction de l’agence', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 3, sousProfession: 'agence' },
      { nom: 'Données personnelles des clients', type: 'INFORMATION', description: 'Pièces d’identité, données bancaires et dossiers des locataires et acquéreurs', responsable: 'DPO / direction', disponibilite: 2, integrite: 4, confidentialite: 4, tracabilite: 3 },
      { nom: 'Maquette numérique du bâtiment (BIM)', type: 'INFORMATION', description: 'Plans, maquettes BIM et données techniques des ouvrages', responsable: 'Direction technique', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 3, sousProfession: 'btp' },
      // Construction / BTP (issue #100)
      { nom: 'Conduite de chantier et planning des travaux', type: 'PROCESSUS', description: 'Pilotage des chantiers, coordination des corps de métier et suivi du planning', responsable: 'Conducteur de travaux', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 3, sousProfession: 'btp' },
    ],
    biensSupports: [
      { nom: 'Logiciel de gestion immobilière / transaction', type: 'LOGICIEL', description: 'Application métier de gestion locative, syndic ou transaction', sousProfession: 'agence' },
      { nom: 'Plateforme de signature électronique', type: 'LOGICIEL', description: 'Signature des baux et compromis de vente à distance' },
      { nom: 'Prestataire de gestion des paiements', type: 'SOUS_TRAITANCE', description: 'Encaissement des loyers et gestion des séquestres', sousProfession: 'agence' },
      // Construction / BTP (issue #100)
      { nom: 'ERP / logiciel de gestion de chantier', type: 'LOGICIEL', description: 'Gestion des devis, achats, planning et suivi financier des chantiers', sousProfession: 'btp' },
      { nom: 'Plateforme BIM collaborative (CDE)', type: 'SOUS_TRAITANCE', description: 'Environnement commun de données partagé entre maîtrise d’œuvre et sous-traitants', sousProfession: 'btp' },
    ],
    evenementsRedoutes: [
      { description: 'Fraude au virement lors d’une transaction immobilière', impacts: ['Perte des fonds (prix de vente)', 'Mise en cause de responsabilité', 'Atteinte à la réputation'], graviteDefaut: 4, sousProfession: 'agence' },
      { description: 'Fuite de données personnelles des clients', impacts: ['Sanction CNIL (RGPD)', 'Usurpation d’identité des clients', 'Perte de confiance'], graviteDefaut: 3 },
      // Construction / BTP (issue #100)
      { description: 'Interruption d’un chantier par cyberattaque', impacts: ['Retard de livraison et pénalités', 'Surcoûts et immobilisation', 'Litiges avec le maître d’ouvrage'], graviteDefaut: 3, sousProfession: 'btp' },
    ],
    sourcesRisque: [
      { nom: 'Escroc au faux ordre de virement (BEC)', categorie: 'CYBERCRIMINEL', description: 'Fraudeur interceptant les échanges pour détourner les fonds d’une transaction ou d’un marché', motivation: 'Lucratif', ressources: 'Moyennes', pertinenceDefaut: 4, motivationScoreDefaut: 4, ressourcesScoreDefaut: 2, activiteScoreDefaut: 4 },
    ],
    scenariosStrategiques: [
      { critere: 'I', nom: 'Fraude au virement (BEC) sur une vente (I)', description: 'Un escroc substitue un faux RIB dans les échanges pour détourner le versement', vraisemblanceDefaut: 3, graviteDefaut: 4, sousProfession: 'agence' },
      { critere: 'D', nom: 'Rançongiciel bloquant la gestion locative (D)', description: 'Un rançongiciel chiffre le SI de gestion et interrompt l’activité', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'agence' },
      // Construction / BTP (issue #100)
      { critere: 'D', nom: 'Rançongiciel bloquant la conduite de chantier (D)', description: 'Un rançongiciel chiffre l’ERP de chantier et interrompt les travaux et la facturation', vraisemblanceDefaut: 3, graviteDefaut: 3, sousProfession: 'btp' },
    ],
  },
}

// ─── MÉDIAS / CULTURE (issue #83) ────────────────────────────────────────────
const MEDIA: SectorFamily = {
  key: 'media',
  match: ['média', 'media', 'presse', 'audiovisuel', 'édition', 'edition', 'journal', 'culture', 'diffusion', 'streaming', 'radio', 'télévision', 'television'],
  exemples: {
    valeursMetier: [
      { nom: 'Production et diffusion de contenus', type: 'PROCESSUS', description: 'Chaîne de production, montage et diffusion des contenus éditoriaux', responsable: 'Direction de la rédaction', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 3 },
      { nom: 'Protection des sources journalistiques', type: 'INFORMATION', description: 'Identité et échanges des sources, protégés par le secret des sources', responsable: 'Rédaction', disponibilite: 2, integrite: 4, confidentialite: 4, tracabilite: 3 },
      { nom: 'Catalogue de contenus et droits', type: 'INFORMATION', description: 'Œuvres, droits de diffusion et données d’abonnés', responsable: 'Direction des contenus', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 3 },
    ],
    biensSupports: [
      { nom: 'Système de gestion de contenu (CMS / MAM)', type: 'LOGICIEL', description: 'Gestion des contenus éditoriaux et des médias (Media Asset Management)' },
      { nom: 'Chaîne de diffusion / streaming', type: 'RESEAU', description: 'Infrastructure de diffusion en direct et à la demande' },
      { nom: 'Plateforme d’abonnés', type: 'LOGICIEL', description: 'Gestion des abonnements et des données d’audience' },
    ],
    evenementsRedoutes: [
      { description: 'Défiguration du site ou détournement de l’antenne', impacts: ['Atteinte à la crédibilité', 'Diffusion de fausses informations', 'Atteinte à la réputation'], graviteDefaut: 4 },
      { description: 'Compromission des sources journalistiques', impacts: ['Violation du secret des sources', 'Mise en danger des sources', 'Sanction déontologique'], graviteDefaut: 4 },
      { description: 'Interruption de la diffusion', impacts: ['Perte d’audience', 'Perte de revenus publicitaires'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Groupe hacktiviste / de désinformation', categorie: 'ACTIVISTE', description: 'Acteur cherchant à défigurer, censurer ou diffuser de la désinformation', motivation: 'Idéologique', ressources: 'Moyennes', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 2, activiteScoreDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'I', nom: 'Défiguration ou détournement de l’antenne (I)', description: 'Un hacktiviste compromet le CMS ou la chaîne de diffusion pour diffuser un message', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'C', nom: 'Exfiltration visant les sources journalistiques (C)', description: 'Un attaquant cible les échanges de la rédaction pour identifier des sources', vraisemblanceDefaut: 2, graviteDefaut: 4 },
    ],
  },
}

// ─── TOURISME / HÔTELLERIE-RESTAURATION (issue #83) ──────────────────────────
const TOURISME: SectorFamily = {
  key: 'tourisme',
  match: ['tourisme', 'hôtel', 'hotel', 'hôtellerie', 'hotellerie', 'restauration', 'restaurant', 'voyage', 'hospitality', 'camping'],
  exemples: {
    valeursMetier: [
      { nom: 'Réservations et séjours clients', type: 'PROCESSUS', description: 'Gestion des réservations, check-in/out et facturation des séjours', responsable: 'Direction de l’établissement', disponibilite: 4, integrite: 3, confidentialite: 3, tracabilite: 3 },
      { nom: 'Données personnelles et de paiement des clients', type: 'INFORMATION', description: 'Coordonnées, préférences et données de carte des clients', responsable: 'Direction / DPO', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Programme de fidélité', type: 'INFORMATION', description: 'Comptes fidélité et historique des clients', responsable: 'Direction marketing', disponibilite: 2, integrite: 3, confidentialite: 3, tracabilite: 3 },
    ],
    biensSupports: [
      { nom: 'Système de gestion hôtelière (PMS)', type: 'LOGICIEL', description: 'Property Management System : réservations, chambres, facturation' },
      { nom: 'Terminaux et système de paiement', type: 'MATERIEL', description: 'TPE et système d’encaissement traitant les données de carte' },
      { nom: 'Plateforme de réservation en ligne (OTA)', type: 'SOUS_TRAITANCE', description: 'Canaux de distribution et agrégateurs de réservation' },
    ],
    evenementsRedoutes: [
      { description: 'Vol des données de carte des clients', impacts: ['Fraude à la carte bancaire', 'Sanction PCI-DSS / CNIL', 'Atteinte à la réputation'], graviteDefaut: 4 },
      { description: 'Indisponibilité du système de réservation', impacts: ['Perte de chiffre d’affaires', 'Impossibilité d’accueillir les clients'], graviteDefaut: 3 },
    ],
    sourcesRisque: [
      { nom: 'Cybercriminel ciblant les données de paiement', categorie: 'CYBERCRIMINEL', description: 'Attaquant visant les données de carte via le PMS ou les terminaux de paiement', motivation: 'Lucratif', ressources: 'Moyennes', pertinenceDefaut: 3, motivationScoreDefaut: 4, ressourcesScoreDefaut: 2, activiteScoreDefaut: 3 },
    ],
    scenariosStrategiques: [
      { critere: 'C', nom: 'Vol de données de carte via le PMS (C)', description: 'Un attaquant exfiltre les données de carte stockées ou en transit', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'D', nom: 'Rançongiciel bloquant l’établissement (D)', description: 'Un rançongiciel chiffre le PMS et bloque l’accueil et la facturation', vraisemblanceDefaut: 3, graviteDefaut: 3 },
    ],
  },
}

// ─── ASSOCIATIONS / ESS (issue #83) ──────────────────────────────────────────
const ASSOCIATION: SectorFamily = {
  key: 'association',
  match: ['association', 'économie sociale', 'economie sociale', 'ess', 'ong', 'fondation', 'non-profit', 'nonprofit', 'caritati', 'bénévol', 'benevol', 'mutuelle solidaire'],
  exemples: {
    valeursMetier: [
      { nom: 'Gestion des adhérents et donateurs', type: 'PROCESSUS', description: 'Adhésions, dons et relation avec les membres', responsable: 'Bureau / trésorier', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 3 },
      { nom: 'Données personnelles des bénéficiaires', type: 'INFORMATION', description: 'Données parfois sensibles des personnes accompagnées', responsable: 'Direction / DPO', disponibilite: 2, integrite: 4, confidentialite: 4, tracabilite: 3 },
      { nom: 'Collecte de dons en ligne', type: 'PROCESSUS', description: 'Campagnes de collecte et paiements des donateurs', responsable: 'Direction / trésorier', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4 },
    ],
    biensSupports: [
      { nom: 'Logiciel de gestion associative / CRM', type: 'LOGICIEL', description: 'Gestion des adhérents, dons et campagnes' },
      { nom: 'Plateforme de collecte de dons en ligne', type: 'SOUS_TRAITANCE', description: 'Prestataire de paiement et de collecte (HelloAsso, etc.)' },
      { nom: 'Site web et réseaux sociaux', type: 'RESEAU', description: 'Présence en ligne et communication de l’association' },
    ],
    evenementsRedoutes: [
      { description: 'Fuite de données des bénéficiaires', impacts: ['Atteinte à la vie privée de personnes vulnérables', 'Sanction CNIL (RGPD)', 'Perte de confiance des donateurs'], graviteDefaut: 4 },
      { description: 'Détournement des dons / fraude', impacts: ['Perte financière', 'Atteinte à la réputation et à la confiance'], graviteDefaut: 3 },
      // Fraude au virement (issue #114)
      { description: 'Détournement d’une subvention ou d’un paiement fournisseur', impacts: ['Perte financière (fonds institutionnels)', 'Mise en cause des dirigeants', 'Rupture de financement du bailleur'], graviteDefaut: 4 },
    ],
    sourcesRisque: [
      { nom: 'Cybercriminel opportuniste', categorie: 'CYBERCRIMINEL', description: 'Attaquant exploitant les faibles moyens de sécurité des associations', motivation: 'Lucratif', ressources: 'Faibles', pertinenceDefaut: 3, motivationScoreDefaut: 3, ressourcesScoreDefaut: 1, activiteScoreDefaut: 3 },
      // Fraude au virement (issue #114)
      { nom: 'Escroc au faux ordre de virement (FOVI)', categorie: 'CYBERCRIMINEL', description: 'Fraudeur usurpant l’identité d’un dirigeant ou d’un fournisseur pour détourner un virement', motivation: 'Lucratif', ressources: 'Moyennes', pertinenceDefaut: 4, motivationScoreDefaut: 4, ressourcesScoreDefaut: 2, activiteScoreDefaut: 4 },
    ],
    scenariosStrategiques: [
      { critere: 'C', nom: 'Fuite de données des bénéficiaires (C)', description: 'Un attaquant exfiltre les données personnelles, parfois sensibles, des bénéficiaires', vraisemblanceDefaut: 3, graviteDefaut: 4 },
      { critere: 'I', nom: 'Détournement de la collecte de dons (I)', description: 'Compromission de la plateforme de dons pour détourner les paiements', vraisemblanceDefaut: 2, graviteDefaut: 3 },
      // Fraude au virement institutionnel (issue #114)
      { critere: 'I', nom: 'Fraude au virement institutionnel (FOVI/BEC) (I)', description: 'Un escroc usurpe l’identité d’un dirigeant ou d’un fournisseur pour détourner un virement de subvention ou un paiement', vraisemblanceDefaut: 3, graviteDefaut: 4 },
    ],
    // Parties prenantes des grandes ONG (issue #114)
    partiesPrenantes: [
      { nom: 'Bailleurs institutionnels (UE, AFD, agences ONU)', type: 'CLIENT', dependance: 4, penetration: 2, maturite: 3, confiance: 3 },
      { nom: 'Commissaire aux comptes', type: 'ORGANISME_REGULATION', dependance: 2, penetration: 1, maturite: 3, confiance: 4 },
      { nom: 'CNIL', type: 'ORGANISME_REGULATION', dependance: 2, penetration: 1, maturite: 4, confiance: 4 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// TECHNIQUE — interconnexions entre SI (tout métier) : contenu dans exemples-sectoriels-ext.ts
// ─────────────────────────────────────────────────────────────────────────────
const TECHNIQUE: SectorFamily = {
  key: 'technique',
  match: ['technique', 'interconnexion', 'interconnection', 'technical', 'technik', 'kopplung', 'técnico', 'tecnico', 'interconexión', 'interconexion', 'interconnessione'],
  exemples: {},
}

// PROTECTION SOCIALE — organismes de sécurité sociale : contenu dans exemples-protection-sociale.ts
const PROTECTION_SOCIALE: SectorFamily = {
  key: 'protection_sociale',
  match: ['protection sociale', 'sécurité sociale', 'securite sociale', 'social protection', 'social security', 'sozialschutz', 'sozialversicherung', 'protección social', 'proteccion social', 'seguridad social', 'protezione sociale', 'previdenza sociale'],
  exemples: {},
}

// TECHNIQUE en tête : « Interconnessione » (it) contient « ess » (famille associations).
// PROTECTION SOCIALE avant SANTÉ et FINANCE : « Sozialversicherung » contient « versicherung ».
export const SECTOR_FAMILIES: SectorFamily[] = [TECHNIQUE, PROTECTION_SOCIALE, SANTE, FINANCE, INDUSTRIE, PUBLIC, TRANSPORT, TELECOM, EDUCATION, COMMERCE, JURIDIQUE, NUMERIQUE, AGRI, DEFENSE, IMMOBILIER, MEDIA, TOURISME, ASSOCIATION]

/**
 * Exemples sectoriels pour un secteur + une catégorie d'atelier.
 * [] si le secteur n'appartient à aucune famille connue ou si la catégorie
 * n'est pas couverte par cette famille.
 */
/** Sous-profession / sous-mode ciblé à partir d'un id de sous-secteur (juridique, transport…). */
function professionFromSousSecteur(sousSecteur?: string | null): string | undefined {
  const v = (sousSecteur ?? '').toLowerCase()
  // Protection sociale : la sous-profession est l'id sans préfixe (ex. protsoc-fraude → fraude)
  if (v.startsWith('protsoc-')) return v.slice('protsoc-'.length)
  // Interconnexions entre SI (famille technique)
  if (v.includes('technique-interco-prestataire')) return 'prestataire'
  if (v.includes('technique-interco-metier')) return 'metier'
  if (v.includes('technique-api')) return 'api'
  if (v.includes('technique-integration')) return 'integration'
  // Santé : portail, entrepôt de données, délégataire de gestion (avant les règles génériques)
  if (v.includes('sante-portail')) return 'portail'
  if (v.includes('sante-entrepot')) return 'entrepot'
  if (v.includes('sante-delegataire')) return 'delegataire'
  // Santé animale : ne reçoit ni le contenu hospitalier ni le contenu « santé humaine » (INS, CPS, DPI…).
  if (v.includes('sante-veterinaire')) return 'veterinaire'
  if (v.includes('notaire')) return 'notaire'
  if (v.includes('avocat')) return 'avocat'
  if (v.includes('huissier')) return 'huissier'
  // Modes transport (issue #97)
  if (v.includes('ferroviaire')) return 'ferroviaire'
  if (v.includes('aerien') || v.includes('aérien')) return 'aerien'
  if (v.includes('maritime')) return 'maritime'
  if (v.includes('logistique')) return 'logistique'
  // Immobilier ≠ construction/BTP (issue #100)
  if (v.includes('btp') || v.includes('construction')) return 'btp'
  if (v.includes('agence') || v.includes('immobilier-agence')) return 'agence'
  // Pharma / chimie industriel (issue #113) — cible `industrie-pharma-chimie`,
  // PAS `sante-pharma` (officine) qui n'a pas de pack dédié.
  if (v.includes('pharma-chimie') || v.includes('industrie-pharma') || v.includes('industrie-chimie')) return 'pharma'
  // Aide à domicile / SAAD-SAP (issue #115)
  if (v.includes('saad') || v.includes('domicile')) return 'saad'
  // Santé détaillée (assurance maladie et usages) — sous-secteurs `sante-*`
  if (v.includes('sante-cabinet') || v.includes('sante-msp')) return 'cabinet'
  if (v.includes('sante-gestion-pro')) return 'gestionpro'
  if (v.includes('sante-amo')) return 'amo'
  if (v.includes('sante-amc')) return 'amc'
  if (v.includes('sante-tiers-payant')) return 'tierspayant'
  if (v.includes('sante-labo')) return 'labo'
  if (v.includes('sante-pharma')) return 'officine'
  if (v.includes('sante-imagerie')) return 'imagerie'
  if (v.includes('sante-transport')) return 'transport'
  if (v.includes('sante-dm-optique')) return 'dm'
  if (v.includes('sante-esante') || v.includes('sante-editeur')) return 'esante'
  // Établissements hospitaliers (issue #115) — voient les actifs hospitaliers
  // (DPI/SIH/PACS), pas les actifs d'aide à domicile.
  if (v.includes('hopital') || v.includes('hôpital') || v.includes('clinique') || v.includes('ehpad')) return 'hopital'
  return undefined
}

/**
 * Sous-profession dérivée du SECTEUR (à défaut de sous-secteur) — issue #111 :
 * la famille FINANCE couvre banque ET assurance ; on distingue « assurance » vs
 * « banque » pour ne pas servir des exemples bancaires trompeurs à un assureur.
 */
function professionFromSecteur(famKey: string, secteur: string): string | undefined {
  if (famKey !== 'finance') return undefined
  if (/assur|mutuelle|prévoyance|prevoyance|réassur|reassur/.test(secteur)) return 'assurance'
  return 'banque'
}

/**
 * Sous-professions santé « détaillées » (assurance maladie et usages) : leurs exemples ne sont proposés que lorsque
 * le sous-secteur correspondant est choisi (sinon ils noieraient les exemples généraux du secteur).
 */
const DETAILED_ONLY = new Set(['cabinet', 'gestionpro', 'amo', 'amc', 'tierspayant', 'labo', 'officine', 'imagerie', 'transport', 'dm', 'esante'])

/** Exemple sectoriel et indication « propre à la sous-profession choisie » (par opposition au socle commun de la famille). */
interface Tagged { item: Record<string, unknown>; specific: boolean }

/** Exemples SECTORIELS proposés pour une catégorie d'atelier, selon le secteur/sous-secteur et la locale (avec marquage). */
function exemplesTagged(
  secteur: string | null | undefined,
  category: SectorExempleCategory,
  locale: Locale,
  sousSecteur?: string | null,
): Tagged[] {
  const s = (secteur ?? '').toLowerCase()
  if (!s) return []
  const fam = SECTOR_FAMILIES.find(f => f.match.some(m => s.includes(m)))
  if (!fam) return []
  const items = fam.exemples[category] ?? []
  const dict = DICTS[locale]
  const prof = professionFromSousSecteur(sousSecteur) ?? professionFromSecteur(fam.key, s)
  // Localisation par INDICE D'ORIGINE (clés i18n indexées), puis filtrage par
  // sous-profession (issue #71), puis retrait du champ technique `sousProfession`.
  const base: Tagged[] = items
    .map((item, idx) => (dict ? localizeItem(item, `${fam.key}.${category}.${idx}`, dict) : { ...item }))
    .filter(it => (prof ? !it.sousProfession || it.sousProfession === prof : !DETAILED_ONLY.has(String(it.sousProfession ?? ''))))
    .map(({ sousProfession, ...rest }) => ({ item: rest, specific: Boolean(prof && sousProfession === prof) }))
  // Extension (textes ×5 dans la donnée) : éléments communs + ceux de la sous-profession choisie.
  const ext: Tagged[] = extItemsFor(fam.key, category, prof).map(x => ({ item: localizeExt(x, locale), specific: Boolean(x.profs) }))
  return [...base, ...ext]
}

/** Exemples SECTORIELS proposés pour une catégorie d'atelier, selon le secteur/sous-secteur et la locale. */
function exemplesForOne(
  secteur: string | null | undefined,
  category: SectorExempleCategory,
  locale: Locale,
  sousSecteur?: string | null,
): Record<string, unknown>[] {
  return exemplesTagged(secteur, category, locale, sousSecteur).map(t => t.item)
}

const TECHNIQUE_IDS = new Set(SOUS_SECTEURS.filter(x => x.famille === 'technique').map(x => x.id))
const KNOWN_IDS = new Set(SOUS_SECTEURS.map(x => x.id))
const TECHNIQUE_SECTEUR = 'Technique / Interconnexion de SI'
const exempleKey = (x: Record<string, unknown>) => String(x.nom ?? x.mesure ?? x.description ?? '').toLowerCase().trim()

/**
 * Union secteur + sous-secteurs + patterns cochés. Ordre : éléments propres aux sous-secteurs choisis, puis ceux des
 * patterns, puis le socle commun du secteur ; sans doublon (clé = nom). Sans secteur, seuls les patterns apportent du contenu.
 */
function withPatterns(secteur: string | null | undefined, category: SectorExempleCategory, locale: Locale, ids: string[], patterns: string[]): Record<string, unknown>[] {
  const selectable = new Set(selectableSousSecteurIds(secteur))
  const parts: Tagged[][] = []
  let ownCovered = false
  for (const id of ids) {
    if (KNOWN_IDS.has(id) && !selectable.has(id)) continue // incohérent avec le secteur
    if (TECHNIQUE_IDS.has(id) && secteurFamily(secteur) !== 'technique') { parts.push(exemplesTagged(TECHNIQUE_SECTEUR, category, locale, id)); continue }
    parts.push(exemplesTagged(secteur, category, locale, id)); ownCovered = true
  }
  if (!ownCovered) parts.unshift(exemplesTagged(secteur, category, locale, null))
  const specific = parts.flatMap(p => p.filter(t => t.specific).map(t => t.item))
  const common = parts.flatMap(p => p.filter(t => !t.specific).map(t => t.item))
  const fromPatterns = patternExemplesFor(patterns, category, locale, secteurFamily(secteur))
  const seen = new Set<string>()
  const out: Record<string, unknown>[] = []
  for (const x of [...specific, ...fromPatterns, ...common]) { const k = exempleKey(x); if (k && seen.has(k)) continue; seen.add(k); out.push(x) }
  return out
}

/**
 * Exemples SECTORIELS pour une catégorie d'atelier, selon le secteur et un ou plusieurs sous-secteurs.
 * Plusieurs sous-secteurs : union dédoublonnée, dans l'ordre de la sélection (le principal d'abord). Cohérence : un
 * sous-secteur d'un autre secteur est ignoré ; un sous-secteur « technique » (interconnexion) choisi pour un autre
 * secteur apporte le contenu des interconnexions. Une valeur inconnue (libellé libre) garde l'ancien comportement.
 */
export function sectorExemplesFor(
  secteur: string | null | undefined,
  category: SectorExempleCategory,
  locale: Locale = 'fr',
  sousSecteur?: string | readonly string[] | null,
  patterns?: readonly string[] | null,
): Record<string, unknown>[] {
  const ids = (Array.isArray(sousSecteur) ? sousSecteur : sousSecteur ? [sousSecteur] : []).filter((x): x is string => typeof x === 'string' && x.trim() !== '')
  // Patterns d'architecture cochés (vision technique, indépendante du secteur) : union avec le secteur et les sous-secteurs.
  const checked = (patterns ?? []).filter(isPatternCode)
  if (checked.length > 0) return withPatterns(secteur, category, locale, ids, checked)
  if (ids.length === 0) return exemplesForOne(secteur, category, locale, null)
  const selectable = new Set(selectableSousSecteurIds(secteur))
  const parts: Record<string, unknown>[][] = []
  let ownCovered = false
  for (const id of ids) {
    if (KNOWN_IDS.has(id) && !selectable.has(id)) continue // incohérent avec le secteur
    if (TECHNIQUE_IDS.has(id) && secteurFamily(secteur) !== 'technique') {
      parts.push(exemplesForOne(TECHNIQUE_SECTEUR, category, locale, id))
      continue
    }
    parts.push(exemplesForOne(secteur, category, locale, id)); ownCovered = true
  }
  // Seulement des interconnexions choisies : le contenu général du secteur reste proposé.
  if (!ownCovered) parts.unshift(exemplesForOne(secteur, category, locale, null))
  const seen = new Set<string>()
  const out: Record<string, unknown>[] = []
  for (const x of parts.flat()) { const k = exempleKey(x); if (k && seen.has(k)) continue; seen.add(k); out.push(x) }
  if (parts.length < 2) return out
  // Élément commun = présent dans toutes les parties : il passe après les éléments propres aux sous-secteurs choisis.
  const keysByPart = parts.map(p => new Set(p.map(exempleKey)))
  const isCommon = (x: Record<string, unknown>) => keysByPart.every(ks => ks.has(exempleKey(x)))
  return [...out.filter(x => !isCommon(x)), ...out.filter(isCommon)]
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
  sousSecteur?: string | readonly string[] | null,
  patterns?: readonly string[] | null,
): T[] {
  const sector = sectorExemplesFor(secteur, category, locale, sousSecteur, patterns) as T[]
  if (!sector.length) return generic
  const keyOf = (e: T) =>
    String((e as { nom?: unknown }).nom ?? (e as { description?: unknown }).description ?? '')
      .toLowerCase()
      .trim()
  const seen = new Set(sector.map(keyOf))
  return [...sector, ...generic.filter(g => !seen.has(keyOf(g)))]
}
