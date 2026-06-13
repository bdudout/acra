// ─────────────────────────────────────────────────────────────────────────────
// Bibliothèque EBIOS RM — données statiques pour guider l'utilisateur
// Source : Guide EBIOS Risk Manager 2018, ANSSI
// Compatible ISO/IEC 27005:2022
// ─────────────────────────────────────────────────────────────────────────────

import { getRiskTier, type RiskTier } from '@/lib/risk-scale'

// ─── Critères DICT ────────────────────────────────────────────────────────────
// Échelles 0–4 (Nul / Faible / Modéré / Important / Critique)
// DIC  → pour les données (informations)
// DICT → pour les services (processus, applications)
export const NIVEAUX_DICT = [
  { value: 0, label: 'Nul',       color: 'text-gray-400',   bg: 'bg-gray-50' },
  { value: 1, label: 'Faible',    color: 'text-green-600',  bg: 'bg-green-50' },
  { value: 2, label: 'Modéré',    color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { value: 3, label: 'Important', color: 'text-orange-600', bg: 'bg-orange-50' },
  { value: 4, label: 'Critique',  color: 'text-red-600',    bg: 'bg-red-50' },
]

export const CRITERES_DICT = [
  { value: 'D', label: 'Disponibilité',  desc: 'Capacité à accéder et utiliser l\'information/service quand nécessaire',     icon: '🟢' },
  { value: 'I', label: 'Intégrité',      desc: 'Exactitude et complétude de l\'information / fiabilité du service',           icon: '🔵' },
  { value: 'C', label: 'Confidentialité',desc: 'Information non divulguée à des personnes/systèmes non autorisés',            icon: '🔴' },
  { value: 'T', label: 'Traçabilité',    desc: 'Capacité à retracer les actions effectuées sur l\'information/service',       icon: '🟡' },
]

export const SECTEURS_ACTIVITE = [
  'Administration publique', 'Banque / Finance', 'Défense / Sécurité nationale',
  'Éducation / Recherche', 'Énergie / Utilities', 'Industrie / Manufacturing',
  'Informatique / Numérique', 'Santé / Médico-social', 'Télécommunications',
  'Transports / Logistique', 'Commerce / Distribution', 'Autre',
]

// ─── Atelier 1 : Biens supports ──────────────────────────────────────────────

export const TYPES_BIEN_SUPPORT = [
  { value: 'MATERIEL',       label: 'Matériel',            emoji: '🖥️' },
  { value: 'LOGICIEL',       label: 'Logiciel',            emoji: '💿' },
  { value: 'RESEAU',         label: 'Réseau',              emoji: '🌐' },
  { value: 'DONNEES',        label: 'Données',             emoji: '🗄️' },
  { value: 'PERSONNEL',      label: 'Personnel',           emoji: '👤' },
  { value: 'SITE',           label: 'Site / Locaux',       emoji: '🏢' },
  { value: 'ORGANISATION',   label: 'Organisation / Processus', emoji: '⚙️' },
  { value: 'SOUS_TRAITANCE', label: 'Sous-traitance / Cloud', emoji: '☁️' },
]

// Catégories de biens supports avec couleurs Tailwind
export const CATEGORIES_BIENS_SUPPORTS = [
  { value: 'MATERIEL',       label: 'Matériel',                emoji: '🖥️',  color: 'bg-blue-100   text-blue-800   border-blue-200'   },
  { value: 'LOGICIEL',       label: 'Logiciel',                emoji: '💿',  color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'RESEAU',         label: 'Réseau',                  emoji: '🌐',  color: 'bg-cyan-100   text-cyan-800   border-cyan-200'   },
  { value: 'DONNEES',        label: 'Données',                 emoji: '🗄️',  color: 'bg-amber-100  text-amber-800  border-amber-200'  },
  { value: 'PERSONNEL',      label: 'Personnel',               emoji: '👤',  color: 'bg-green-100  text-green-800  border-green-200'  },
  { value: 'SITE',           label: 'Site / Bâtiment',        emoji: '🏢',  color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'ORGANISATION',   label: 'Organisation / Processus',emoji: '⚙️',  color: 'bg-gray-100   text-gray-800   border-gray-200'   },
  { value: 'SOUS_TRAITANCE', label: 'Cloud / Sous-traitance', emoji: '☁️',  color: 'bg-sky-100    text-sky-800    border-sky-200'    },
] as const

export type CategorieBienSupport = typeof CATEGORIES_BIENS_SUPPORTS[number]['value']

export const BIENS_SUPPORTS_EXEMPLES: {
  nom: string
  type: CategorieBienSupport
  description: string
}[] = [
  // ── Matériel ──────────────────────────────────────────────────────────────
  { nom: 'Postes de travail',           type: 'MATERIEL',       description: 'PC, laptops des employés' },
  { nom: 'Serveurs physiques',          type: 'MATERIEL',       description: 'Serveurs hébergeant les applications et données' },
  { nom: 'Smartphones / Tablettes',     type: 'MATERIEL',       description: 'Terminaux mobiles des collaborateurs' },
  { nom: 'Serveurs de sauvegarde',      type: 'MATERIEL',       description: 'NAS, serveurs de backup' },
  { nom: 'Imprimantes / Copieurs',      type: 'MATERIEL',       description: 'Équipements d\'impression multifonctions' },
  { nom: 'Contrôleurs industriels (ICS/SCADA)', type: 'MATERIEL', description: 'Automates, PLCs, équipements OT' },
  { nom: 'HSM / Modules de sécurité',   type: 'MATERIEL',       description: 'Hardware Security Module, cartes à puce' },
  // ── Logiciel ──────────────────────────────────────────────────────────────
  { nom: 'Système d\'exploitation',     type: 'LOGICIEL',       description: 'Windows Server, Linux, macOS...' },
  { nom: 'Active Directory / LDAP',     type: 'LOGICIEL',       description: 'Annuaire et gestion des identités' },
  { nom: 'ERP / Logiciel métier',       type: 'LOGICIEL',       description: 'SAP, Oracle, Sage, logiciel spécifique' },
  { nom: 'Messagerie',                  type: 'LOGICIEL',       description: 'Exchange, Office 365, Gmail...' },
  { nom: 'Application web / portail',   type: 'LOGICIEL',       description: 'Site web, portail client, e-commerce' },
  { nom: 'Antivirus / EDR',             type: 'LOGICIEL',       description: 'Solution de protection des endpoints' },
  { nom: 'SIEM / Supervision sécurité', type: 'LOGICIEL',       description: 'Splunk, Microsoft Sentinel, Elastic SIEM' },
  { nom: 'Gestionnaire de mots de passe', type: 'LOGICIEL',     description: 'KeePass, HashiCorp Vault, CyberArk' },
  { nom: 'Hyperviseur / Virtualisation',type: 'LOGICIEL',       description: 'VMware ESXi, Hyper-V, KVM' },
  // ── Réseau ────────────────────────────────────────────────────────────────
  { nom: 'Équipements réseau actifs',   type: 'RESEAU',         description: 'Switchs, routeurs, firewalls, bornes Wi-Fi' },
  { nom: 'Réseau LAN',                  type: 'RESEAU',         description: 'Réseau interne de l\'organisation' },
  { nom: 'Connexion Internet / WAN',    type: 'RESEAU',         description: 'Accès Internet, liaison opérateur, fibre' },
  { nom: 'Réseau Wi-Fi',                type: 'RESEAU',         description: 'Infrastructure sans fil' },
  { nom: 'DMZ',                         type: 'RESEAU',         description: 'Zone démilitarisée pour les services exposés' },
  { nom: 'VPN / Accès distant',         type: 'RESEAU',         description: 'Accès distant sécurisé pour les collaborateurs' },
  { nom: 'Réseau OT / industriel',      type: 'RESEAU',         description: 'Réseau de supervision industrielle, isolé du SI' },
  // ── Données ───────────────────────────────────────────────────────────────
  { nom: 'Base de données',             type: 'DONNEES',        description: 'PostgreSQL, MySQL, Oracle, SQL Server' },
  { nom: 'Données clients',             type: 'DONNEES',        description: 'Fichiers clients, CRM, informations personnelles' },
  { nom: 'Données RH',                  type: 'DONNEES',        description: 'Dossiers employés, paie, évaluations' },
  { nom: 'Données financières',         type: 'DONNEES',        description: 'Comptabilité, facturation, trésorerie' },
  { nom: 'Propriété intellectuelle',    type: 'DONNEES',        description: 'Brevets, code source, plans, R&D' },
  { nom: 'Sauvegardes',                 type: 'DONNEES',        description: 'Archives et copies de sauvegarde' },
  { nom: 'Données de configuration',    type: 'DONNEES',        description: 'Fichiers de configuration, scripts d\'infra' },
  // ── Personnel ─────────────────────────────────────────────────────────────
  { nom: 'Administrateurs SI',          type: 'PERSONNEL',      description: 'Équipe IT, administrateurs systèmes et réseaux' },
  { nom: 'Direction',                   type: 'PERSONNEL',      description: 'PDG, DG, membres du CODIR' },
  { nom: 'Équipes métier',              type: 'PERSONNEL',      description: 'Utilisateurs des applications critiques' },
  { nom: 'Équipe sécurité (RSSI / SOC)',type: 'PERSONNEL',      description: 'Responsables sécurité, analystes SOC' },
  { nom: 'Développeurs',                type: 'PERSONNEL',      description: 'Développeurs internes, équipes DevOps' },
  // ── Site / Bâtiment ───────────────────────────────────────────────────────
  { nom: 'Salle serveurs / Datacenter', type: 'SITE',           description: 'Local technique hébergeant l\'infrastructure' },
  { nom: 'Bureaux',                     type: 'SITE',           description: 'Locaux de travail des employés' },
  { nom: 'Alimentation électrique',     type: 'SITE',           description: 'Onduleurs, groupes électrogènes, TGBT' },
  { nom: 'Climatisation / Refroidissement', type: 'SITE',       description: 'Systèmes de refroidissement de la salle serveurs' },
  { nom: 'Contrôle d\'accès physique',  type: 'SITE',           description: 'Badges, digicodes, vidéosurveillance' },
  // ── Organisation ──────────────────────────────────────────────────────────
  { nom: 'Processus de gestion des identités', type: 'ORGANISATION', description: 'Onboarding, offboarding, révision des droits' },
  { nom: 'Politique de sécurité (PSSI)', type: 'ORGANISATION',  description: 'Chartes, procédures, règles de sécurité' },
  { nom: 'Processus de gestion des incidents', type: 'ORGANISATION', description: 'Plan de réponse aux incidents, astreintes' },
  { nom: 'Plan de continuité (PCA/PRA)', type: 'ORGANISATION',  description: 'Procédures de reprise après sinistre' },
  // ── Cloud / Sous-traitance ────────────────────────────────────────────────
  { nom: 'Hébergement cloud (IaaS)',    type: 'SOUS_TRAITANCE', description: 'AWS, Azure, GCP, OVH...' },
  { nom: 'SaaS métier',                 type: 'SOUS_TRAITANCE', description: 'Salesforce, Office 365, Google Workspace...' },
  { nom: 'Prestataire de maintenance',  type: 'SOUS_TRAITANCE', description: 'Infogérant, ESN, sous-traitant informatique' },
  { nom: 'CDN / Protection DDoS',       type: 'SOUS_TRAITANCE', description: 'Cloudflare, Akamai, AWS CloudFront' },
]

// ─── Atelier 1 : Événements redoutés ─────────────────────────────────────────

export const EVENEMENTS_REDOUTES_EXEMPLES = [
  {
    description: 'Divulgation de données personnelles (clients, employés)',
    impacts: ['Atteinte à la vie privée', 'Sanctions RGPD', 'Perte de confiance', 'Atteinte à la réputation'],
    graviteDefaut: 3,
  },
  {
    description: 'Indisponibilité du système d\'information (panne totale)',
    impacts: ['Arrêt de la production', 'Perte de chiffre d\'affaires', 'Non respect des engagements contractuels'],
    graviteDefaut: 4,
  },
  {
    description: 'Altération / destruction de données critiques',
    impacts: ['Corruption des données métier', 'Impossibilité de traiter les dossiers', 'Perte irréversible d\'informations'],
    graviteDefaut: 4,
  },
  {
    description: 'Divulgation de secrets commerciaux / propriété intellectuelle',
    impacts: ['Avantage concurrentiel perdu', 'Perte de marché', 'Atteinte à la valorisation'],
    graviteDefaut: 3,
  },
  {
    description: 'Fraude financière via le SI (virement frauduleux, détournement)',
    impacts: ['Perte financière directe', 'Engagement de responsabilité', 'Atteinte à la réputation'],
    graviteDefaut: 4,
  },
  {
    description: 'Sabotage de systèmes industriels / OT',
    impacts: ['Arrêt de production', 'Risque sécurité physique', 'Dommages matériels'],
    graviteDefaut: 4,
  },
  {
    description: 'Atteinte à l\'image via défacement ou campagne de désinformation',
    impacts: ['Perte de clients', 'Couverture médiatique négative', 'Impact sur le cours boursier'],
    graviteDefaut: 2,
  },
  {
    description: 'Déni de service (DDoS) sur les services en ligne',
    impacts: ['Inaccessibilité des services', 'Perte de revenus', 'Mécontentement clients'],
    graviteDefaut: 3,
  },
  {
    description: 'Compromission de l\'infrastructure critique (ransomware)',
    impacts: ['Chiffrement des données', 'Arrêt total du SI', 'Rançon', 'Coût de restauration'],
    graviteDefaut: 4,
  },
  {
    description: 'Vol de données de santé / données sensibles',
    impacts: ['Violation secret médical', 'Sanctions CNIL', 'Perte de confiance des patients'],
    graviteDefaut: 4,
  },
]

export const NIVEAUX_GRAVITE = [
  { value: 1, label: 'Négligeable', color: 'text-gray-500',  bg: 'bg-gray-100',   description: 'Impact mineur, sans conséquence significative' },
  { value: 2, label: 'Limitée',     color: 'text-green-600', bg: 'bg-green-100',  description: 'Impact limité, récupérable facilement' },
  { value: 3, label: 'Importante',  color: 'text-yellow-600',bg: 'bg-yellow-100', description: 'Impact significatif sur l\'activité ou la réputation' },
  { value: 4, label: 'Critique',    color: 'text-red-600',   bg: 'bg-red-100',    description: 'Impact majeur pouvant menacer la pérennité de l\'organisation' },
]

export const NIVEAUX_VRAISEMBLANCE = [
  { value: 1, label: 'Minime',      color: 'text-gray-500',  bg: 'bg-gray-100',   description: 'Très peu probable, aucun précédent connu' },
  { value: 2, label: 'Significative', color: 'text-green-600', bg: 'bg-green-100', description: 'Peu probable mais possible' },
  { value: 3, label: 'Forte',       color: 'text-yellow-600',bg: 'bg-yellow-100', description: 'Probable, des précédents existent dans le secteur' },
  { value: 4, label: 'Maximale',    color: 'text-red-600',   bg: 'bg-red-100',    description: 'Très probable, scénario connu et répété' },
]

// ─── Atelier 1 : Valeurs métier (exemples avec critères DICT) ────────────────
// type PROCESSUS/SERVICE → DICT    |    type INFORMATION/DONNEES → DIC
export const VALEURS_METIER_EXEMPLES = [
  {
    nom: 'Gestion des commandes clients', type: 'PROCESSUS',
    description: 'Processus de prise de commande, facturation et livraison',
    disponibilite: 4, integrite: 3, confidentialite: 2, tracabilite: 3,
  },
  {
    nom: 'Base de données clients', type: 'INFORMATION',
    description: 'Données personnelles et historiques achats des clients',
    disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 3,
  },
  {
    nom: 'Processus de paie', type: 'PROCESSUS',
    description: 'Calcul et versement des salaires et charges sociales',
    disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4,
  },
  {
    nom: 'Données RH et contrats', type: 'INFORMATION',
    description: 'Dossiers employés, contrats, évaluations',
    disponibilite: 2, integrite: 4, confidentialite: 4, tracabilite: 3,
  },
  {
    nom: 'Service de production', type: 'PROCESSUS',
    description: 'Lignes de production, contrôle qualité, maintenance',
    disponibilite: 4, integrite: 4, confidentialite: 2, tracabilite: 3,
  },
  {
    nom: 'Propriété intellectuelle / R&D', type: 'INFORMATION',
    description: 'Brevets, formules, secrets industriels, résultats de recherche',
    disponibilite: 2, integrite: 4, confidentialite: 4, tracabilite: 3,
  },
  {
    nom: 'Service de vente en ligne', type: 'PROCESSUS',
    description: 'Plateforme e-commerce, catalogue, paiements',
    disponibilite: 4, integrite: 3, confidentialite: 3, tracabilite: 3,
  },
  {
    nom: 'Stratégie et plans d\'affaires', type: 'INFORMATION',
    description: 'Plans stratégiques, offres commerciales, partenariats confidentiels',
    disponibilite: 2, integrite: 3, confidentialite: 4, tracabilite: 3,
  },
  {
    nom: 'Service support client', type: 'PROCESSUS',
    description: 'Helpdesk, gestion des incidents, réclamations',
    disponibilite: 3, integrite: 3, confidentialite: 2, tracabilite: 3,
  },
  {
    nom: 'Données financières et comptables', type: 'INFORMATION',
    description: 'Comptes, bilan, flux financiers, données bancaires',
    disponibilite: 3, integrite: 4, confidentialite: 4, tracabilite: 4,
  },
]

// ─── Atelier 3 : Scénarios stratégiques (exemples par critère DICT) ───────────
// Compatibles ISO 27005 — un scénario par critère minimum recommandé
export const SCENARIOS_STRATEGIQUES_EXEMPLES = [
  // ── Disponibilité (D) ──────────────────────────────────────────────────────
  {
    critere: 'D',
    nom: 'Indisponibilité du SI par ransomware (D)',
    description: 'Un groupe cybercriminel compromet le SI via un ransomware, chiffrant les données et rendant les services inaccessibles plusieurs jours.',
    vraisemblanceDefaut: 3,
    graviteDefaut: 4,
  },
  {
    critere: 'D',
    nom: 'Déni de service distribué (DDoS) sur les services en ligne (D)',
    description: 'Saturation des serveurs web et passerelles exposées par un flux massif de requêtes, rendant les services inaccessibles aux utilisateurs légitimes.',
    vraisemblanceDefaut: 3,
    graviteDefaut: 3,
  },
  {
    critere: 'D',
    nom: 'Panne critique d\'infrastructure cloud / hébergeur (D)',
    description: 'Défaillance majeure d\'un prestataire cloud ou hébergeur entraînant une indisponibilité prolongée des applications hébergées.',
    vraisemblanceDefaut: 2,
    graviteDefaut: 3,
  },
  // ── Intégrité (I) ──────────────────────────────────────────────────────────
  {
    critere: 'I',
    nom: 'Altération de données critiques via compromission d\'un compte administrateur (I)',
    description: 'Un attaquant ayant compromis un compte à privilèges modifie silencieusement des données métier (stocks, prix, dossiers RH, résultats financiers).',
    vraisemblanceDefaut: 2,
    graviteDefaut: 4,
  },
  {
    critere: 'I',
    nom: 'Attaque sur la chaîne d\'approvisionnement logicielle (I)',
    description: 'Un prestataire ou fournisseur de logiciel compromis injecte du code malveillant dans une mise à jour, altérant le fonctionnement des applications.',
    vraisemblanceDefaut: 2,
    graviteDefaut: 4,
  },
  {
    critere: 'I',
    nom: 'Fraude par modification de données financières (I)',
    description: 'Un employé malveillant ou un attaquant externe modifie des données comptables ou bancaires pour réaliser des détournements de fonds.',
    vraisemblanceDefaut: 2,
    graviteDefaut: 4,
  },
  // ── Confidentialité (C) ────────────────────────────────────────────────────
  {
    critere: 'C',
    nom: 'Exfiltration de données clients / personnelles (C)',
    description: 'Un attaquant exfiltre la base de données clients (données personnelles, coordonnées bancaires) via une vulnérabilité applicative ou un accès compromis.',
    vraisemblanceDefaut: 3,
    graviteDefaut: 4,
  },
  {
    critere: 'C',
    nom: 'Vol de propriété intellectuelle / secrets commerciaux (C)',
    description: 'Un concurrent ou groupe étatique infiltre le réseau pour exfiltrer des plans, brevets, code source ou résultats R&D confidentiels.',
    vraisemblanceDefaut: 2,
    graviteDefaut: 4,
  },
  {
    critere: 'C',
    nom: 'Divulgation de données RH et données sensibles employés (C)',
    description: 'Des données RH confidentielles (salaires, dossiers médicaux, évaluations) sont divulguées suite à un accès non autorisé ou une erreur de configuration.',
    vraisemblanceDefaut: 2,
    graviteDefaut: 3,
  },
  // ── Traçabilité (T) ────────────────────────────────────────────────────────
  {
    critere: 'T',
    nom: 'Destruction des journaux d\'audit et traces de sécurité (T)',
    description: 'Un attaquant ayant obtenu des droits élevés efface ou falsifie les journaux de sécurité pour dissimuler ses actions et compromettre les investigations.',
    vraisemblanceDefaut: 2,
    graviteDefaut: 3,
  },
  {
    critere: 'T',
    nom: 'Falsification des preuves numériques et logs applicatifs (T)',
    description: 'Des logs applicatifs ou systèmes sont manipulés pour masquer des transactions frauduleuses ou des accès non autorisés, rendant impossible la reconstitution des faits.',
    vraisemblanceDefaut: 2,
    graviteDefaut: 3,
  },
]

// ─── Atelier 1 : Socle de sécurité (référentiels) ────────────────────────────

export const REFERENTIELS_SECURITE = [
  { nom: 'ISO/IEC 27001:2022',   description: 'Système de Management de la Sécurité de l\'Information' },
  { nom: 'ISO/IEC 27002:2022',   description: 'Mesures de sécurité de l\'information' },
  { nom: 'RGPD',                 description: 'Règlement Général sur la Protection des Données' },
  { nom: 'NIS2',                 description: 'Directive européenne sur la sécurité des réseaux et systèmes d\'information' },
  { nom: 'RGS',                  description: 'Référentiel Général de Sécurité (ANSSI)' },
  { nom: 'HDS',                  description: 'Hébergeur de Données de Santé' },
  { nom: 'PCI-DSS',              description: 'Payment Card Industry Data Security Standard' },
  { nom: 'SOC 2',                description: 'Service Organization Control 2' },
  { nom: 'LPM',                  description: 'Loi de Programmation Militaire (OIV)' },
  { nom: 'DORA',                 description: 'Digital Operational Resilience Act (secteur financier)' },
  { nom: 'CIS Controls v8',      description: 'Center for Internet Security Controls' },
  { nom: 'NIST CSF 2.0',         description: 'NIST Cybersecurity Framework' },
]

// ─── Atelier 2 : Sources de risque ───────────────────────────────────────────

export const SOURCES_RISQUE_EXEMPLES = [
  {
    nom: 'Cybercriminel organisé',
    categorie: 'CYBERCRIMINEL',
    description: 'Groupe criminel motivé par le gain financier (ransomware, fraude, revente de données)',
    motivation: 'Gain financier',
    ressources: 'Moyens importants, outils sophistiqués, accès au dark web',
    pertinenceDefaut: 3,
  },
  {
    nom: 'État / groupe étatique',
    categorie: 'ETAT_NATION',
    description: 'Services de renseignement ou unités cyber militaires d\'un État étranger',
    motivation: 'Espionnage, sabotage, déstabilisation politique',
    ressources: 'Ressources illimitées, 0-day, accès privilégiés',
    pertinenceDefaut: 2,
  },
  {
    nom: 'Concurrent déloyal',
    categorie: 'CONCURRENT',
    description: 'Entreprise concurrente cherchant à obtenir un avantage compétitif',
    motivation: 'Espionnage industriel, vol de propriété intellectuelle',
    ressources: 'Moyens limités à importants selon la taille',
    pertinenceDefaut: 2,
  },
  {
    nom: 'Hacktiviste',
    categorie: 'ACTIVISTE',
    description: 'Individu ou groupe motivé par des convictions idéologiques, politiques ou sociales',
    motivation: 'Idéologique, nuire à l\'image, dénoncer',
    ressources: 'Outils publics, faibles à moyens',
    pertinenceDefaut: 2,
  },
  {
    nom: 'Employé malveillant',
    categorie: 'EMPLOYE_MALVEILLANT',
    description: 'Collaborateur interne agissant de façon malveillante (sabotage, vol, fraude)',
    motivation: 'Revanche, appât du gain, coercition',
    ressources: 'Accès internes légitimes, connaissance du SI',
    pertinenceDefaut: 3,
  },
  {
    nom: 'Prestataire / sous-traitant compromis',
    categorie: 'PRESTATAIRE',
    description: 'Tiers ayant un accès au SI et dont les systèmes ont été compromis',
    motivation: 'Vecteur d\'attaque par rebond',
    ressources: 'Accès VPN, comptes de service, outils de gestion',
    pertinenceDefaut: 3,
  },
  {
    nom: 'Amateur / Script kiddie',
    categorie: 'AMATEUR',
    description: 'Individu peu qualifié utilisant des outils existants par curiosité ou défi',
    motivation: 'Défi personnel, curiosité, reconnaissance',
    ressources: 'Outils disponibles gratuitement, compétences limitées',
    pertinenceDefaut: 2,
  },
  {
    nom: 'Terroriste cyber',
    categorie: 'TERRORISTE',
    description: 'Groupe cherchant à provoquer des dommages physiques ou sociaux via le cyber',
    motivation: 'Déstabilisation, terreur, cause extrémiste',
    ressources: 'Variables, généralement limités techniquement',
    pertinenceDefaut: 1,
  },
]

export const OBJECTIFS_VISES_EXEMPLES = [
  { nom: 'Espionnage / Vol de données sensibles',   description: 'Obtenir des informations confidentielles (données clients, R&D, stratégie)' },
  { nom: 'Sabotage du SI',                          description: 'Détruire ou perturber durablement les systèmes d\'information' },
  { nom: 'Extorsion (ransomware)',                  description: 'Chiffrer les données et exiger une rançon pour les restituer' },
  { nom: 'Fraude financière',                       description: 'Réaliser des virements frauduleux, détourner des fonds' },
  { nom: 'Déni de service (DDoS)',                  description: 'Rendre les services inaccessibles aux utilisateurs légitimes' },
  { nom: 'Atteinte à la réputation',                description: 'Nuire à l\'image de l\'organisation par divulgation ou défacement' },
  { nom: 'Prise de contrôle du SI',                 description: 'S\'octroyer des accès privilégiés persistants pour rebondir' },
  { nom: 'Perturbation des processus métier',       description: 'Interrompre les processus opérationnels critiques' },
  { nom: 'Vol de propriété intellectuelle',         description: 'S\'approprier des brevets, code source, plans de fabrication' },
  { nom: 'Compromission de la chaîne d\'approvisionnement', description: 'Utiliser l\'organisation comme vecteur pour attaquer ses clients/partenaires' },
]

// ─── Atelier 3 : Parties prenantes ───────────────────────────────────────────

export const PARTIES_PRENANTES_EXEMPLES = [
  { nom: 'Prestataire informatique / ESN',      type: 'PRESTATAIRE',    exposition: 4, fiabilite: 3 },
  { nom: 'Hébergeur cloud (AWS/Azure/GCP)',     type: 'FOURNISSEUR',    exposition: 4, fiabilite: 3 },
  { nom: 'Fournisseur SaaS (Office 365, etc.)', type: 'FOURNISSEUR',    exposition: 3, fiabilite: 3 },
  { nom: 'Clients (accès portail)',             type: 'CLIENT',         exposition: 2, fiabilite: 2 },
  { nom: 'Partenaires métier',                  type: 'PARTENAIRE',     exposition: 3, fiabilite: 3 },
  { nom: 'Sous-traitant industriel',            type: 'SOUS_TRAITANT',  exposition: 3, fiabilite: 2 },
  { nom: 'Filiales / Groupe',                  type: 'PARTENAIRE',     exposition: 4, fiabilite: 3 },
  { nom: 'Télémaintenance industrielle',        type: 'PRESTATAIRE',    exposition: 4, fiabilite: 2 },
  { nom: 'Cabinet comptable / Audit',           type: 'PRESTATAIRE',    exposition: 2, fiabilite: 3 },
  { nom: 'Opérateur télécom',                  type: 'FOURNISSEUR',    exposition: 3, fiabilite: 3 },
]

// ─── Atelier 4 : Actions élémentaires (inspirées MITRE ATT&CK) ───────────────

export const ACTIONS_ELEMENTAIRES_EXEMPLES = [
  // Reconnaissance
  { type: 'RECONNAISSANCE', nom: 'Reconnaissance passive (OSINT)', description: 'Collecte d\'informations publiques : LinkedIn, WHOIS, Shodan, jobboards' },
  { type: 'RECONNAISSANCE', nom: 'Scan réseau / détection des services exposés', description: 'Nmap, Shodan pour identifier les ports et services ouverts' },
  // Accès initial
  { type: 'ACCES_INITIAL', nom: 'Phishing ciblé (spear-phishing)', description: 'Email frauduleux avec pièce jointe malveillante ou lien vers faux site' },
  { type: 'ACCES_INITIAL', nom: 'Exploitation d\'une vulnérabilité web', description: 'Exploitation de failles (SQLi, XSS, RCE) sur une application exposée' },
  { type: 'ACCES_INITIAL', nom: 'Credential stuffing / brute force', description: 'Utilisation de listes de credentials divulguées sur des services exposés' },
  { type: 'ACCES_INITIAL', nom: 'Compromission de la supply chain', description: 'Injection de code malveillant via un prestataire ou une mise à jour logicielle' },
  { type: 'ACCES_INITIAL', nom: 'VPN/RDP exposé non patché', description: 'Exploitation d\'une vulnérabilité sur un accès distant (Citrix, Pulse, ProxyLogon)' },
  // Persistance
  { type: 'PERSISTANCE', nom: 'Installation d\'un backdoor / RAT', description: 'Mise en place d\'un accès persistant (Cobalt Strike, Meterpreter)' },
  { type: 'PERSISTANCE', nom: 'Création de comptes privilégiés', description: 'Ajout de comptes administrateurs locaux ou AD' },
  // Mouvement latéral
  { type: 'MOUVEMENT_LATERAL', nom: 'Pass-the-Hash / Pass-the-Ticket', description: 'Réutilisation des hashes NTLM ou tickets Kerberos pour se déplacer' },
  { type: 'MOUVEMENT_LATERAL', nom: 'Exploitation de shares réseau', description: 'Accès aux partages réseau pour pivoter ou exfiltrer' },
  // Exfiltration
  { type: 'EXFILTRATION', nom: 'Exfiltration via HTTPS/DNS', description: 'Envoi de données chiffrées vers un serveur C2 externe' },
  { type: 'EXFILTRATION', nom: 'Upload vers service cloud (OneDrive, Mega)', description: 'Copie de données vers un espace cloud personnel' },
  // Impact
  { type: 'IMPACT', nom: 'Chiffrement ransomware', description: 'Déploiement d\'un ransomware (Ryuk, LockBit, BlackCat) sur l\'ensemble du SI' },
  { type: 'IMPACT', nom: 'Destruction de sauvegardes', description: 'Effacement des backups pour empêcher la restauration' },
  { type: 'IMPACT', nom: 'Déni de service distribué (DDoS)', description: 'Saturation de la bande passante ou des ressources serveur' },
]

export const TYPES_ACTION_ELEMENTAIRE = [
  { value: 'RECONNAISSANCE',    label: 'Reconnaissance',        color: 'bg-purple-100 text-purple-700' },
  { value: 'ACCES_INITIAL',     label: 'Accès initial',         color: 'bg-red-100 text-red-700' },
  { value: 'PERSISTANCE',       label: 'Persistance',           color: 'bg-orange-100 text-orange-700' },
  { value: 'ESCALADE_PRIVILEGES', label: 'Escalade de privilèges', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'MOUVEMENT_LATERAL', label: 'Mouvement latéral',     color: 'bg-blue-100 text-blue-700' },
  { value: 'EXFILTRATION',      label: 'Exfiltration',          color: 'bg-teal-100 text-teal-700' },
  { value: 'IMPACT',            label: 'Impact / Destruction',  color: 'bg-rose-100 text-rose-700' },
]

// ─── Atelier 3 : Mesures d'écosystème (ISO/IEC 27002:2022 — supply chain & tiers) ──

export const MESURES_ECOSYSTEME_EXEMPLES = [
  // Gouvernance tiers (5.19–5.22 ISO 27002)
  { mesure: 'Clauses contractuelles de sécurité', type: 'ORGANISATIONNELLE', iso27005: '5.19', description: 'Exiger des engagements contractuels sur la confidentialité, la continuité et le signalement d\'incidents' },
  { mesure: 'Questionnaire d\'évaluation sécurité prestataire', type: 'ORGANISATIONNELLE', iso27005: '5.19', description: 'Évaluer le niveau de maturité SSI du prestataire avant engagement (ISO 27001, SOC2, CSPN…)' },
  { mesure: 'Audit de sécurité des tiers (annuel)', type: 'DETECTIVE', iso27005: '5.22', description: 'Audit ou revue documentaire annuelle des pratiques SSI des prestataires critiques' },
  { mesure: 'Politique de gestion des accès prestataires', type: 'ORGANISATIONNELLE', iso27005: '5.20', description: 'Comptes nominatifs, accès limités au périmètre nécessaire, révocation immédiate en fin de mission' },
  // Contrôle des accès (5.15, 8.2 ISO 27002)
  { mesure: 'Accès distant prestataire via VPN dédié + MFA', type: 'TECHNIQUE', iso27005: '8.5', description: 'Tunnel VPN dédié par prestataire, authentification forte, sessions enregistrées' },
  { mesure: 'Bastion / jump host pour les accès tiers', type: 'TECHNIQUE', iso27005: '8.2', description: 'Tout accès à distance via un bastion (CyberArk, Wallix) avec journalisation des sessions' },
  { mesure: 'Revue trimestrielle des accès tiers', type: 'ORGANISATIONNELLE', iso27005: '5.18', description: 'Revoir et révoquer les accès non utilisés ou non justifiés tous les trimestres' },
  // Surveillance (8.15, 8.16 ISO 27002)
  { mesure: 'Surveillance des actions prestataires (logs)', type: 'DETECTIVE', iso27005: '8.15', description: 'Journaliser et alerter sur les actions sensibles des comptes prestataires (AD, serveurs, DB)' },
  { mesure: 'Alerte en cas d\'activité anormale tiers', type: 'DETECTIVE', iso27005: '8.16', description: 'Règles SIEM dédiées aux comptes tiers : connexions hors horaires, exports massifs, escalade de privilèges' },
  // Continuité & incident (5.29, 5.30 ISO 27002)
  { mesure: 'Obligation de notification d\'incident sous 24h', type: 'ORGANISATIONNELLE', iso27005: '5.26', description: 'Clause contractuelle imposant au prestataire de notifier tout incident ou suspicion d\'incident sous 24h' },
  { mesure: 'Plan de reprise d\'activité avec le tiers (PRA conjoint)', type: 'ORGANISATIONNELLE', iso27005: '5.30', description: 'Définir les engagements de continuité mutuels (RTO/RPO), testés annuellement' },
  // Sécurité physique (7.2 ISO 27002)
  { mesure: 'Contrôle des accès physiques aux locaux tiers', type: 'PHYSIQUE', iso27005: '7.2', description: 'Restriction des accès physiques aux zones hébergeant des données client, badges nominatifs, registre de passage' },
]

// ─── Atelier 5 : Mesures de sécurité (ISO/IEC 27002:2022) ──────────────────────

export const MESURES_SECURITE_EXEMPLES = [
  // Techniques — contrôle d'accès (8.x)
  { nom: 'Authentification multi-facteurs (MFA)', type: 'TECHNIQUE', prioriteDefaut: 1, iso27005: '8.5',  description: 'Déployer la MFA sur tous les accès sensibles (VPN, AD, webmail, applications critiques)' },
  { nom: 'Segmentation réseau (VLAN, micro-segmentation)', type: 'TECHNIQUE', prioriteDefaut: 1, iso27005: '8.22', description: 'Isoler les réseaux critiques (prod, OT, DMZ) pour limiter les mouvements latéraux' },
  { nom: 'Solution EDR / XDR sur les endpoints', type: 'TECHNIQUE', prioriteDefaut: 1, iso27005: '8.7',  description: 'Déployer un EDR (CrowdStrike, SentinelOne, Microsoft Defender for Endpoint) sur tous les postes' },
  { nom: 'Gestion des correctifs (patch management)', type: 'TECHNIQUE', prioriteDefaut: 1, iso27005: '8.8',  description: 'Processus de mise à jour régulière des systèmes et applications (WSUS, SCCM, Ansible)' },
  { nom: 'Chiffrement des données sensibles (repos + transit)', type: 'TECHNIQUE', prioriteDefaut: 2, iso27005: '8.24', description: 'TLS 1.3 pour les flux, chiffrement des disques (BitLocker, LUKS) et des bases de données' },
  { nom: 'Sauvegarde 3-2-1 avec tests de restauration', type: 'TECHNIQUE', prioriteDefaut: 1, iso27005: '8.13', description: '3 copies sur 2 supports différents dont 1 hors site (ou air-gapped). Tests mensuels de restauration' },
  { nom: 'SIEM — surveillance et détection centralisée', type: 'TECHNIQUE', prioriteDefaut: 2, iso27005: '8.15', description: 'Centralisation et analyse des logs (Splunk, ELK, Microsoft Sentinel) avec règles de détection' },
  { nom: 'Filtrage de messagerie (anti-phishing, anti-spam)', type: 'TECHNIQUE', prioriteDefaut: 1, iso27005: '8.23', description: 'Solution de sécurité email avec analyse des pièces jointes et des URLs' },
  { nom: 'WAF (Web Application Firewall)', type: 'TECHNIQUE', prioriteDefaut: 2, iso27005: '8.31', description: 'Protection des applications web exposées contre les attaques OWASP Top 10' },
  { nom: 'Gestion des accès à privilèges (PAM)', type: 'TECHNIQUE', prioriteDefaut: 2, iso27005: '8.2',  description: 'Solution PAM (CyberArk, BeyondTrust) pour gérer et auditer les comptes administrateurs' },
  // Organisationnelles (5.x)
  { nom: 'Politique de sécurité des SI (PSSI)', type: 'ORGANISATIONNELLE', prioriteDefaut: 1, iso27005: '5.1',  description: 'Rédiger et approuver une PSSI adaptée au contexte, révisée annuellement' },
  { nom: 'Formation et sensibilisation des utilisateurs', type: 'ORGANISATIONNELLE', prioriteDefaut: 1, iso27005: '6.3',  description: 'Programme de sensibilisation annuel + simulations de phishing régulières' },
  { nom: 'Plan de réponse aux incidents (PRI)', type: 'ORGANISATIONNELLE', prioriteDefaut: 2, iso27005: '5.26', description: 'Procédures documentées pour détecter, contenir, éradiquer et récupérer d\'un incident' },
  { nom: 'Plan de continuité d\'activité (PCA/PRA)', type: 'ORGANISATIONNELLE', prioriteDefaut: 2, iso27005: '5.29', description: 'Documenter et tester les procédures de continuité en cas de crise majeure' },
  { nom: 'Gestion des tiers et de la supply chain', type: 'ORGANISATIONNELLE', prioriteDefaut: 2, iso27005: '5.19', description: 'Clauses contractuelles, audit des prestataires, questionnaires de sécurité' },
  { nom: 'Gestion des identités et des accès (IAM)', type: 'ORGANISATIONNELLE', prioriteDefaut: 1, iso27005: '5.16', description: 'Principe du moindre privilège, revue des droits trimestrielle, processus d\'offboarding' },
  { nom: 'Veille sur les vulnérabilités (CVE, CERT-FR)', type: 'ORGANISATIONNELLE', prioriteDefaut: 2, iso27005: '5.7',  description: 'Abonnement aux bulletins CERT-FR, ANSSI, NVD. Processus de qualification et traitement' },
  // Détection (8.x)
  { nom: 'Tests d\'intrusion annuels (PASSI)', type: 'DETECTIVE', prioriteDefaut: 2, iso27005: '8.8',  description: 'Pentest externe et interne par un prestataire qualifié PASSI au moins une fois par an' },
  { nom: 'Revue des logs et alertes de sécurité', type: 'DETECTIVE', prioriteDefaut: 2, iso27005: '8.15', description: 'Supervision quotidienne des alertes de sécurité, triage et investigation' },
  { nom: 'Exercices de crise cyber (Red Team / Tabletop)', type: 'DETECTIVE', prioriteDefaut: 3, iso27005: '5.26', description: 'Simulation d\'incidents pour tester la réponse humaine et les procédures' },
]

export const STRATEGIES_TRAITEMENT = [
  {
    value: 'REDUIRE',
    label: 'Réduire',
    color: 'bg-blue-100 text-blue-700',
    description: 'Mettre en place des mesures pour réduire la probabilité ou l\'impact du risque',
    conseil: 'Stratégie recommandée pour les risques importants et critiques',
  },
  {
    value: 'ACCEPTER',
    label: 'Accepter',
    color: 'bg-green-100 text-green-700',
    description: 'Accepter le risque tel quel, en connaissance de cause',
    conseil: 'À réserver aux risques résiduels faibles ou négligeables après traitement',
  },
  {
    value: 'TRANSFERER',
    label: 'Transférer',
    color: 'bg-yellow-100 text-yellow-700',
    description: 'Transférer le risque à un tiers (assurance cyber, sous-traitant)',
    conseil: 'Convient aux risques financiers ou pour lesquels un tiers est mieux équipé',
  },
  {
    value: 'REFUSER',
    label: 'Refuser / Éviter',
    color: 'bg-red-100 text-red-700',
    description: 'Supprimer l\'activité ou le processus à l\'origine du risque',
    conseil: 'Si le risque est inacceptable et non traitable autrement',
  },
  {
    value: 'SURVEILLER',
    label: 'Surveiller',
    color: 'bg-purple-100 text-purple-700',
    description: 'Surveiller l\'évolution du risque sans action immédiate',
    conseil: 'Pour les risques émergents dont l\'évolution est incertaine',
  },
]

// ─── ISO 27001:2022 Annexe A — 93 contrôles ──────────────────────────────────
// Source : ISO/IEC 27001:2022, Annexe A (normative) — noms français officiels

export interface ISO27001Controle {
  ref: string
  nom: string
  description: string
  type: 'ORGANISATIONNELLE' | 'HUMAINE' | 'PHYSIQUE' | 'TECHNOLOGIQUE'
  categorie: '5' | '6' | '7' | '8'
}

export const ISO27001_CATEGORIES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  '5': { label: 'Contrôles organisationnels', icon: '🏢', color: 'text-purple-700', bg: 'bg-purple-50' },
  '6': { label: 'Contrôles relatifs aux personnes', icon: '👥', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  '7': { label: 'Contrôles physiques',               icon: '🔒', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  '8': { label: 'Contrôles technologiques',          icon: '💻', color: 'text-teal-700',   bg: 'bg-teal-50'   },
}

export const ISO27001_ANNEXE_A: ISO27001Controle[] = [
  // ── 5. Contrôles organisationnels (37 contrôles) ──────────────────────────
  { ref: '5.1',  type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Politiques de sécurité de l\'information',                          description: 'Définir, approuver, publier et réexaminer régulièrement des politiques de sécurité de l\'information.' },
  { ref: '5.2',  type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Fonctions et responsabilités liées à la sécurité',                  description: 'Attribuer et communiquer les fonctions et responsabilités en matière de sécurité de l\'information.' },
  { ref: '5.3',  type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Séparation des tâches',                                             description: 'Séparer les tâches et les domaines de responsabilité conflictuels pour réduire les risques de fraude.' },
  { ref: '5.4',  type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Responsabilités de la direction',                                   description: 'La direction doit exiger de tous les personnels qu\'ils appliquent la sécurité de l\'information.' },
  { ref: '5.5',  type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Contact avec les autorités',                                        description: 'Maintenir des contacts appropriés avec les autorités compétentes (ANSSI, CNIL, parquet cyber...).' },
  { ref: '5.6',  type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Contact avec des groupes d\'intérêt spéciaux',                      description: 'Maintenir des contacts avec des groupes d\'intérêt spéciaux, forums de sécurité et associations professionnelles.' },
  { ref: '5.7',  type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Renseignements sur les menaces (Threat Intelligence)',               description: 'Collecter et analyser des informations sur les menaces pertinentes pour produire des renseignements actionnables.' },
  { ref: '5.8',  type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Sécurité de l\'information dans la gestion de projet',              description: 'Intégrer la sécurité de l\'information dans la gestion de projet, quel que soit le type de projet.' },
  { ref: '5.9',  type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Inventaire des actifs informationnels',                             description: 'Identifier les actifs informationnels et les autres actifs associés, les inventorier et les maintenir.' },
  { ref: '5.10', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Utilisation acceptable des actifs',                                 description: 'Identifier, documenter et mettre en œuvre des règles d\'utilisation acceptable des actifs.' },
  { ref: '5.11', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Restitution des actifs',                                            description: 'Restituer tous les actifs de l\'organisation à la fin du contrat ou de la mission.' },
  { ref: '5.12', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Classification des informations',                                   description: 'Classifier les informations selon les besoins de sécurité en fonction de leur sensibilité.' },
  { ref: '5.13', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Marquage des informations',                                         description: 'Développer et mettre en œuvre des procédures de marquage des informations conformément à leur classification.' },
  { ref: '5.14', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Transfert de l\'information',                                       description: 'Disposer de règles, procédures et accords pour le transfert d\'informations (email, support, verbal...).' },
  { ref: '5.15', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Contrôle d\'accès',                                                 description: 'Définir et mettre en œuvre des règles de contrôle d\'accès aux informations et aux actifs associés.' },
  { ref: '5.16', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Gestion des identités',                                             description: 'Gérer le cycle de vie complet des identités (création, modification, révocation, revue périodique).' },
  { ref: '5.17', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Gestion des informations d\'authentification',                      description: 'Gérer les informations d\'authentification (mots de passe, clés, tokens) selon un processus formalisé.' },
  { ref: '5.18', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Droits d\'accès',                                                   description: 'Attribuer, réviser, modifier et supprimer les droits d\'accès selon le principe du moindre privilège.' },
  { ref: '5.19', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Sécurité dans les relations avec les fournisseurs',                 description: 'Identifier et mettre en œuvre des processus pour gérer les risques liés aux produits et services des fournisseurs.' },
  { ref: '5.20', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Accords de sécurité avec les fournisseurs',                        description: 'Définir et convenir des exigences de sécurité dans les accords avec chaque fournisseur.' },
  { ref: '5.21', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Sécurité dans la chaîne d\'approvisionnement TIC',                 description: 'Définir et mettre en œuvre des processus pour gérer les risques de sécurité liés à la chaîne d\'approvisionnement TIC.' },
  { ref: '5.22', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Surveillance et revue des services fournisseurs',                   description: 'Surveiller, réviser et auditer régulièrement les pratiques de sécurité des fournisseurs.' },
  { ref: '5.23', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Sécurité pour les services en nuage (Cloud)',                      description: 'Définir et gérer les exigences de sécurité pour l\'acquisition et l\'utilisation des services cloud.' },
  { ref: '5.24', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Planification de la gestion des incidents',                        description: 'Planifier et préparer la gestion des incidents de sécurité : rôles, responsabilités, procédures.' },
  { ref: '5.25', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Évaluation et décision sur les événements de sécurité',            description: 'Évaluer les événements de sécurité et décider s\'ils doivent être classifiés comme incidents.' },
  { ref: '5.26', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Réponse aux incidents de sécurité',                                description: 'Répondre aux incidents de sécurité conformément aux procédures documentées (containment, éradication, recovery).' },
  { ref: '5.27', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Retour d\'expérience des incidents (REX)',                         description: 'Tirer des enseignements des incidents pour renforcer les contrôles et améliorer les processus.' },
  { ref: '5.28', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Collecte des preuves numériques',                                  description: 'Établir et appliquer des procédures de collecte, conservation et présentation des preuves numériques.' },
  { ref: '5.29', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Continuité d\'activité en cas de perturbation',                    description: 'Planifier la continuité de la sécurité de l\'information en cas d\'incident ou de perturbation majeure.' },
  { ref: '5.30', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Préparation TIC pour la continuité d\'activité',                   description: 'Préparer les capacités TIC pour assurer la continuité d\'activité lors de perturbations.' },
  { ref: '5.31', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Exigences légales, réglementaires et contractuelles',              description: 'Identifier et documenter toutes les exigences légales, réglementaires et contractuelles applicables à la sécurité.' },
  { ref: '5.32', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Droits de propriété intellectuelle',                               description: 'Mettre en œuvre des procédures pour protéger les droits de propriété intellectuelle.' },
  { ref: '5.33', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Protection des enregistrements',                                   description: 'Protéger les enregistrements contre la perte, la destruction, la falsification et les accès non autorisés.' },
  { ref: '5.34', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Vie privée et protection des données personnelles (RGPD)',         description: 'Identifier et respecter les exigences relatives à la protection de la vie privée et des données personnelles.' },
  { ref: '5.35', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Revue indépendante de la sécurité de l\'information',              description: 'Faire réaliser des revues indépendantes (audit interne ou externe) de la sécurité de l\'information.' },
  { ref: '5.36', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Conformité aux politiques et normes de sécurité',                  description: 'Réexaminer régulièrement la conformité au regard des politiques, normes et procédures de sécurité.' },
  { ref: '5.37', type: 'ORGANISATIONNELLE', categorie: '5', nom: 'Procédures d\'exploitation documentées',                           description: 'Documenter les procédures d\'exploitation des installations de traitement de l\'information.' },

  // ── 6. Contrôles relatifs aux personnes (8 contrôles) ────────────────────
  { ref: '6.1', type: 'HUMAINE', categorie: '6', nom: 'Sélection du personnel (background check)',                                   description: 'Vérifier les antécédents de tous les candidats avant embauche, conformément à la législation.' },
  { ref: '6.2', type: 'HUMAINE', categorie: '6', nom: 'Termes et conditions d\'embauche',                                            description: 'Formaliser les responsabilités en matière de sécurité dans les contrats de travail.' },
  { ref: '6.3', type: 'HUMAINE', categorie: '6', nom: 'Sensibilisation et formation à la sécurité',                                  description: 'Assurer la sensibilisation, la formation et le développement des compétences sécurité de tout le personnel.' },
  { ref: '6.4', type: 'HUMAINE', categorie: '6', nom: 'Processus disciplinaire',                                                     description: 'Formaliser et communiquer un processus disciplinaire pour les violations de sécurité.' },
  { ref: '6.5', type: 'HUMAINE', categorie: '6', nom: 'Responsabilités après fin de contrat',                                        description: 'Définir, formaliser et gérer les responsabilités en matière de sécurité lors de départs ou changements de poste.' },
  { ref: '6.6', type: 'HUMAINE', categorie: '6', nom: 'Accords de confidentialité (NDA)',                                            description: 'Identifier, documenter et revoir les accords de confidentialité correspondant aux besoins de sécurité.' },
  { ref: '6.7', type: 'HUMAINE', categorie: '6', nom: 'Télétravail',                                                                 description: 'Mettre en œuvre des mesures de sécurité pour les personnels en situation de télétravail.' },
  { ref: '6.8', type: 'HUMAINE', categorie: '6', nom: 'Signalement des événements de sécurité',                                     description: 'Fournir aux personnels un mécanisme simple pour signaler les événements de sécurité observés.' },

  // ── 7. Contrôles physiques (14 contrôles) ────────────────────────────────
  { ref: '7.1',  type: 'PHYSIQUE', categorie: '7', nom: 'Périmètres de sécurité physiques',                                          description: 'Définir et utiliser des périmètres de sécurité physiques pour protéger les zones sensibles.' },
  { ref: '7.2',  type: 'PHYSIQUE', categorie: '7', nom: 'Contrôles d\'accès physiques',                                             description: 'Protéger les zones sécurisées par des contrôles d\'accès physiques appropriés (badge, biométrie, gardiennage).' },
  { ref: '7.3',  type: 'PHYSIQUE', categorie: '7', nom: 'Sécurisation des bureaux et salles',                                       description: 'Concevoir et appliquer une sécurité physique pour les bureaux, salles et locaux techniques.' },
  { ref: '7.4',  type: 'PHYSIQUE', categorie: '7', nom: 'Surveillance de la sécurité physique',                                     description: 'Surveiller en continu les locaux et zones sensibles contre les intrusions (CCTV, détection intrusion).' },
  { ref: '7.5',  type: 'PHYSIQUE', categorie: '7', nom: 'Protection contre les menaces physiques et environnementales',             description: 'Concevoir et mettre en œuvre des protections contre les menaces physiques : incendie, inondation, tremblement de terre...' },
  { ref: '7.6',  type: 'PHYSIQUE', categorie: '7', nom: 'Travail dans les zones sécurisées',                                        description: 'Mettre en œuvre des procédures pour le travail dans les zones sécurisées (visiteurs, supervision, traçabilité).' },
  { ref: '7.7',  type: 'PHYSIQUE', categorie: '7', nom: 'Bureau propre et écran vide (Clear Desk & Screen)',                        description: 'Définir et appliquer des règles de bureau propre (documents, supports) et d\'écran vide (verrouillage).' },
  { ref: '7.8',  type: 'PHYSIQUE', categorie: '7', nom: 'Emplacement et protection des équipements',                                description: 'Choisir l\'emplacement et protéger les équipements pour réduire les risques d\'accès non autorisé et de dommages.' },
  { ref: '7.9',  type: 'PHYSIQUE', categorie: '7', nom: 'Sécurité des actifs hors locaux',                                         description: 'Appliquer des mesures de sécurité aux actifs utilisés hors des locaux de l\'organisation (nomades, télétravailleurs).' },
  { ref: '7.10', type: 'PHYSIQUE', categorie: '7', nom: 'Supports de stockage',                                                     description: 'Gérer le cycle de vie des supports de stockage (acquisition, utilisation, transport, destruction sécurisée).' },
  { ref: '7.11', type: 'PHYSIQUE', categorie: '7', nom: 'Équipements d\'infrastructure de support',                                 description: 'Protéger les équipements contre les coupures d\'alimentation et les défaillances d\'infrastructure (UPS, groupe électrogène, climatisation).' },
  { ref: '7.12', type: 'PHYSIQUE', categorie: '7', nom: 'Sécurisation du câblage',                                                  description: 'Protéger les câbles d\'alimentation et de communication contre les interceptions ou dommages.' },
  { ref: '7.13', type: 'PHYSIQUE', categorie: '7', nom: 'Maintenance des équipements',                                              description: 'Maintenir correctement les équipements pour assurer leur disponibilité et leur intégrité.' },
  { ref: '7.14', type: 'PHYSIQUE', categorie: '7', nom: 'Mise au rebut et recyclage sécurisés des équipements',                     description: 'Vérifier que les données sensibles sont effacées de manière sécurisée avant toute mise au rebut ou réutilisation.' },

  // ── 8. Contrôles technologiques (34 contrôles) ───────────────────────────
  { ref: '8.1',  type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Terminaux des utilisateurs (endpoint security)',                       description: 'Protéger les terminaux utilisateurs (PC, mobiles, tablettes) via politique de configuration et outils dédiés.' },
  { ref: '8.2',  type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Droits d\'accès privilégiés (PAM)',                                   description: 'Restreindre et gérer l\'attribution des droits d\'accès privilégiés (comptes admin, root, SA).' },
  { ref: '8.3',  type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Restriction d\'accès aux informations',                               description: 'Restreindre l\'accès aux informations et aux fonctions selon la politique de contrôle d\'accès.' },
  { ref: '8.4',  type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Accès au code source',                                                description: 'Gérer et restreindre l\'accès au code source, aux outils de développement et aux bibliothèques logicielles.' },
  { ref: '8.5',  type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Authentification sécurisée (MFA)',                                    description: 'Mettre en œuvre des technologies et procédures d\'authentification forte, notamment la MFA.' },
  { ref: '8.6',  type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Gestion de la capacité',                                              description: 'Surveiller et ajuster les ressources pour garantir les performances et la disponibilité attendues.' },
  { ref: '8.7',  type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Protection contre les logiciels malveillants (anti-malware)',         description: 'Mettre en œuvre une protection contre les malwares et la compléter par des contrôles organisationnels.' },
  { ref: '8.8',  type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Gestion des vulnérabilités techniques',                               description: 'Obtenir des informations sur les vulnérabilités techniques, les évaluer et les traiter (patch management, pentest).' },
  { ref: '8.9',  type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Gestion de la configuration (CMDB)',                                  description: 'Établir, documenter, mettre en œuvre, surveiller et réviser les configurations de sécurité.' },
  { ref: '8.10', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Suppression sécurisée des informations',                             description: 'Supprimer les informations stockées dans les systèmes et supports lorsqu\'elles ne sont plus nécessaires.' },
  { ref: '8.11', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Masquage des données (Data Masking)',                                 description: 'Masquer les données sensibles conformément à la politique de contrôle d\'accès et aux réglementations.' },
  { ref: '8.12', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Prévention des fuites de données (DLP)',                              description: 'Détecter et prévenir la divulgation non autorisée d\'informations sensibles via des outils DLP.' },
  { ref: '8.13', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Sauvegarde des informations (règle 3-2-1)',                           description: 'Maintenir et tester régulièrement des copies de sauvegarde des données et des logiciels conformément à la politique.' },
  { ref: '8.14', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Redondance des équipements de traitement',                           description: 'Mettre en œuvre des équipements de traitement redondants pour satisfaire les exigences de disponibilité.' },
  { ref: '8.15', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Journalisation (logs)',                                               description: 'Produire, stocker, protéger et analyser les journaux enregistrant les activités, exceptions et événements de sécurité.' },
  { ref: '8.16', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Surveillance des activités (SIEM)',                                   description: 'Surveiller les réseaux, systèmes et applications pour détecter les comportements anormaux (SIEM, SOC).' },
  { ref: '8.17', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Synchronisation des horloges (NTP)',                                  description: 'Synchroniser les horloges de tous les systèmes sur une source de temps de référence unique et sécurisée.' },
  { ref: '8.18', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Utilisation des programmes utilitaires à privilèges',                 description: 'Restreindre et contrôler étroitement l\'utilisation des utilitaires susceptibles de contourner les contrôles.' },
  { ref: '8.19', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Installation de logiciels en production',                             description: 'Mettre en œuvre des procédures de contrôle de l\'installation de logiciels sur les systèmes en exploitation.' },
  { ref: '8.20', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Sécurité des réseaux (firewall, IDS/IPS)',                           description: 'Sécuriser, gérer et contrôler les réseaux et les équipements réseau pour protéger les informations.' },
  { ref: '8.21', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Sécurité des services réseau',                                        description: 'Identifier, mettre en œuvre et surveiller les mécanismes de sécurité des services réseau (SLA, monitoring).' },
  { ref: '8.22', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Séparation des réseaux (segmentation, VLAN)',                        description: 'Séparer les groupes de services, utilisateurs et systèmes d\'information dans des réseaux distincts.' },
  { ref: '8.23', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Filtrage web (proxy, DNS filtering)',                                 description: 'Gérer et restreindre l\'accès aux sites web pour protéger contre les contenus malveillants.' },
  { ref: '8.24', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Utilisation de la cryptographie (TLS, chiffrement)',                  description: 'Définir et mettre en œuvre des règles d\'utilisation de la cryptographie, dont la gestion des clés.' },
  { ref: '8.25', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Cycle de vie de développement sécurisé (SDL)',                       description: 'Établir et appliquer des règles de développement sécurisé des logiciels et systèmes.' },
  { ref: '8.26', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Exigences de sécurité des applications',                             description: 'Identifier, spécifier et approuver les exigences de sécurité lors du développement ou de l\'acquisition d\'applications.' },
  { ref: '8.27', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Architecture de système sécurisée (Security by Design)',             description: 'Établir, documenter et appliquer des principes d\'architecture et d\'ingénierie de systèmes sécurisés.' },
  { ref: '8.28', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Codage sécurisé (OWASP, SAST)',                                      description: 'Appliquer des principes de codage sécurisé au développement logiciel (OWASP Top 10, revues de code, SAST).' },
  { ref: '8.29', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Tests de sécurité en développement et acceptation',                  description: 'Définir et mettre en œuvre des processus de tests de sécurité tout au long du cycle de développement.' },
  { ref: '8.30', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Développement externalisé',                                          description: 'Diriger, surveiller et réviser les activités liées au développement de systèmes externalisé.' },
  { ref: '8.31', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Séparation environnements dev / test / production',                  description: 'Séparer les environnements de développement, de test et de production pour réduire les risques.' },
  { ref: '8.32', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Gestion des changements',                                            description: 'Soumettre les modifications du système d\'information à des procédures formelles de gestion des changements.' },
  { ref: '8.33', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Données de test',                                                    description: 'Choisir, protéger et gérer les données de test de manière appropriée (anonymisation, pseudonymisation).' },
  { ref: '8.34', type: 'TECHNOLOGIQUE', categorie: '8', nom: 'Protection des SI pendant les tests d\'audit',                       description: 'Planifier et convenir des tests d\'audit impliquant l\'évaluation des systèmes d\'exploitation en production.' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Habillage Tailwind par palier de risque (source unique : getRiskTier).
const RISK_TIER_STYLE: Record<RiskTier, { label: string; color: string; bg: string }> = {
  critique: { label: 'Critique', color: 'text-red-700',    bg: 'bg-red-100' },
  eleve:    { label: 'Élevé',    color: 'text-orange-700', bg: 'bg-orange-100' },
  modere:   { label: 'Modéré',   color: 'text-yellow-700', bg: 'bg-yellow-100' },
  faible:   { label: 'Faible',   color: 'text-green-700',  bg: 'bg-green-100' },
}

export function getNiveauRisqueLabel(score: number): { label: string; color: string; bg: string } {
  return RISK_TIER_STYLE[getRiskTier(score)]
}

export const ATELIERS_META = [
  {
    num: 1,
    titre: 'Cadrage et socle de sécurité',
    sousTitre: 'Définir le périmètre, les biens à protéger et les événements redoutés',
    icon: '🎯',
    couleur: 'indigo',
    description: `L'atelier 1 pose les fondations de votre analyse. Vous allez définir le périmètre de l'étude, identifier les valeurs métier que vous devez protéger, les biens supports qui les portent, et les événements redoutés si ces valeurs étaient compromises.`,
    etapes: ['Périmètre et objectifs', 'Valeurs métier', 'Biens supports', 'Événements redoutés', 'Socle de sécurité'],
  },
  {
    num: 2,
    titre: 'Sources de risque',
    sousTitre: 'Identifier qui pourrait vous attaquer et dans quel but',
    icon: '🎭',
    couleur: 'red',
    description: `L'atelier 2 vous permet d'identifier les sources de risque (qui ?) et leurs objectifs visés (pour quoi faire ?). Parmi les combinaisons possibles, vous sélectionnerez celles qui sont pertinentes pour votre contexte.`,
    etapes: ['Sources de risque', 'Objectifs visés', 'Pertinence et sélection'],
  },
  {
    num: 3,
    titre: 'Scénarios stratégiques',
    sousTitre: 'Construire les chemins d\'attaque via l\'écosystème',
    icon: '🗺️',
    couleur: 'orange',
    description: `L'atelier 3 consiste à construire des scénarios d'attaque en se concentrant sur les chemins stratégiques : comment une source de risque pourrait passer par vos parties prenantes (fournisseurs, prestataires, clients) pour atteindre vos valeurs métier.`,
    etapes: ['Cartographie des parties prenantes', 'Scénarios stratégiques', 'Évaluation de la vraisemblance'],
  },
  {
    num: 4,
    titre: 'Scénarios opérationnels',
    sousTitre: 'Détailler les attaques techniques étape par étape',
    icon: '⚙️',
    couleur: 'yellow',
    description: `L'atelier 4 traduit les scénarios stratégiques en scénarios techniques détaillés. Pour chaque scénario, vous décrivez la séquence d'actions élémentaires (reconnaissance, intrusion, persistance, exfiltration...) et évaluez leur vraisemblance technique.`,
    etapes: ['Scénarios opérationnels', 'Actions élémentaires', 'Vraisemblance technique'],
  },
  {
    num: 5,
    titre: 'Traitement du risque',
    sousTitre: 'Décider comment traiter chaque risque et planifier les mesures',
    icon: '🛡️',
    couleur: 'green',
    description: `L'atelier 5 conclut l'analyse. Pour chaque risque identifié, vous choisissez une stratégie de traitement (réduire, accepter, transférer, refuser), définissez les mesures de sécurité à mettre en place et évaluez le niveau de risque résiduel.`,
    etapes: ['Synthèse des risques', 'Stratégie de traitement', 'Mesures de sécurité', 'Risques résiduels', 'Plan d\'action'],
  },
]
