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
  key: 'sante' | 'finance' | 'industrie' | 'public'
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
      { nom: 'Prise en charge des patients aux urgences', type: 'PROCESSUS', description: 'Accueil, tri, soins et orientation des patients en situation d’urgence', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 3 },
      { nom: 'Dossier Patient Informatisé (DPI)', type: 'INFORMATION', description: 'Données de santé, antécédents, prescriptions et comptes rendus des patients', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Circuit du médicament', type: 'PROCESSUS', description: 'Prescription, dispensation et administration des traitements', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4 },
      { nom: 'Imagerie médicale (PACS)', type: 'INFORMATION', description: 'Images radiologiques et comptes rendus d’examens des patients', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3 },
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
      { nom: 'Exécution des paiements et virements', type: 'PROCESSUS', description: 'Traitement des ordres de paiement, virements SEPA et SWIFT', disponibilite: 4, integrite: 4, confidentialite: 3, tracabilite: 4 },
      { nom: 'Core banking (tenue des comptes)', type: 'INFORMATION', description: 'Soldes, opérations et référentiel clients du système central', disponibilite: 4, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Octroi de crédit et scoring', type: 'PROCESSUS', description: 'Évaluation du risque et décision d’octroi de crédit', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
      { nom: 'Lutte anti-fraude et conformité (LCB-FT)', type: 'PROCESSUS', description: 'Détection de fraude, blanchiment et financement du terrorisme', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
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
      { nom: 'Conduite de la production industrielle', type: 'PROCESSUS', description: 'Pilotage des lignes de production et des procédés via le système OT', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 3 },
      { nom: 'Supervision et conduite du procédé (SCADA)', type: 'INFORMATION', description: 'Données temps réel de supervision et de commande des installations', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Sûreté de fonctionnement des installations', type: 'PROCESSUS', description: 'Systèmes instrumentés de sécurité protégeant personnes et environnement', disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Maintenance et télégestion', type: 'PROCESSUS', description: 'Télémaintenance et exploitation à distance des équipements industriels', disponibilite: 3, integrite: 4, confidentialite: 2, tracabilite: 4 },
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
      { nom: 'Services en ligne aux usagers', type: 'PROCESSUS', description: 'Téléservices et démarches administratives dématérialisées', disponibilite: 4, integrite: 3, confidentialite: 3, tracabilite: 3 },
      { nom: 'État civil et registres', type: 'INFORMATION', description: 'Actes d’état civil, listes électorales et registres officiels', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4 },
      { nom: 'Gestion des délibérations et actes', type: 'PROCESSUS', description: 'Préparation, vote et publication des délibérations et arrêtés', disponibilite: 3, integrite: 4, confidentialite: 2, tracabilite: 4 },
      { nom: 'Données fiscales et sociales des administrés', type: 'INFORMATION', description: 'Données fiscales, sociales et personnelles des usagers', disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4 },
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

export const SECTOR_FAMILIES: SectorFamily[] = [SANTE, FINANCE, INDUSTRIE, PUBLIC]

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
