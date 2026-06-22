/**
 * ACRA — Seed de démonstration
 *
 * Crée :
 *  - 3 utilisateurs (admin, analyste, risk_manager) avec mots de passe bcrypt
 *  - 1 analyse complète "CHU Métropole — Sécurité SI Patient" couvrant les 5 ateliers
 *  - Configuration par défaut (échelles 4 niveaux)
 *  - Politique de mots de passe globale
 *
 * Usage : npx prisma db seed
 *         npm run db:seed
 */

import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'

const prisma = new PrismaClient()

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Identifiant de seed aléatoire cryptographiquement sûr (évite js/insecure-randomness ;
// Math.random() n'est pas adapté à la génération d'identifiants).
function id() {
  return randomBytes(8).toString('hex')
}

// ─── Configuration par défaut (échelles 4 niveaux) ────────────────────────────

const DEFAULT_ECHELLE_GRAVITE = [
  { niveau: 1, label: 'Négligeable', description: 'Impact sans conséquence notable', couleur: '#22c55e' },
  { niveau: 2, label: 'Limitée', description: 'Impact maîtrisable sans aide extérieure', couleur: '#eab308' },
  { niveau: 3, label: 'Importante', description: 'Impact significatif sur les activités', couleur: '#f97316' },
  { niveau: 4, label: 'Critique', description: 'Impact mettant en danger la survie de l\'organisation', couleur: '#ef4444' },
]

const DEFAULT_ECHELLE_VRAISEMBLANCE = [
  { niveau: 1, label: 'Minime', description: 'Scénario peu probable, aucun cas connu', couleur: '#22c55e' },
  { niveau: 2, label: 'Significative', description: 'Scénario possible, quelques cas connus', couleur: '#eab308' },
  { niveau: 3, label: 'Forte', description: 'Scénario probable dans le secteur', couleur: '#f97316' },
  { niveau: 4, label: 'Maximale', description: 'Scénario très probable ou déjà survenu', couleur: '#ef4444' },
]

// Seuils de la matrice (score = gravité × vraisemblance) — alignés sur getNiveauRisqueLabel
const DEFAULT_SEUILS_MATRICE = [
  { scoreMin: 1,  scoreMax: 3,  label: 'Faible',   couleur: '#22c55e' },
  { scoreMin: 4,  scoreMax: 7,  label: 'Modéré',   couleur: '#f59e0b' },
  { scoreMin: 8,  scoreMax: 11, label: 'Élevé',    couleur: '#f97316' },
  { scoreMin: 12, scoreMax: 25, label: 'Critique', couleur: '#ef4444' },
]

// ─── IDs des entités de démo ──────────────────────────────────────────────────

// Valeurs métier
const VM_DOSSIER    = id()
const VM_IMAGERIE   = id()
const VM_PHARMACIE  = id()
const VM_URGENCES   = id()

// Biens supports
const BS_SIH        = id()
const BS_PACS       = id()
const BS_RESEAU     = id()
const BS_AD         = id()
const BS_SAUVEGARDE = id()

// Événements redoutés
const ER_FUITE      = id()
const ER_INDISPO    = id()
const ER_ALTERATION = id()

// Sources de risque
const SR_CYBER      = id()
const SR_INTERNE    = id()
const SR_APT        = id()

// Parties prenantes
const PP_BIOMEDICAL = id()
const PP_EDITEUR    = id()
const PP_LABO       = id()

// Scénarios stratégiques
const SS_RANSOMWARE = id()
const SS_EXFIL      = id()

// Scénarios opérationnels
const SO_PHISHING   = id()
const SO_VULN_VPN   = id()

// Risques
const R_RANSOMWARE  = id()
const R_FUITE_DATA  = id()

// Mesures
const M1 = id(), M2 = id(), M3 = id(), M4 = id(), M5 = id()

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seed ACRA — démarrage...')

  // ── Politique de mots de passe ────────────────────────────────────────────
  // PasswordPolicy — upsert via raw query to avoid TS issues with new model
  // Politique ANSSI guide d'hygiène v2 : 12 car. min, complexité complète, 90j renouvellement
  await prisma.$executeRaw`
    INSERT INTO "PasswordPolicy" (id, "minLength", "requireUppercase", "requireLowercase", "requireNumbers", "requireSpecial", "maxAgeDays", "updatedAt")
    VALUES ('global', 12, true, true, true, true, 90, NOW())
    ON CONFLICT (id) DO NOTHING
  `

  // ── Utilisateurs ─────────────────────────────────────────────────────────
  // Mots de passe conformes ANSSI : ≥12 car., maj+min+chiffre+spécial
  const adminHash    = await bcrypt.hash('Acra@Admin2024!', 10)
  const analysteHash = await bcrypt.hash('Acra@Analyste24!', 10)
  const rmHash       = await bcrypt.hash('Acra@Rssi2024!!', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@chu-metropole.fr' },
    update: {},
    create: {
      name: 'Admin ACRA',
      email: 'admin@chu-metropole.fr',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
    },
  })

  const analyste = await prisma.user.upsert({
    where: { email: 'analyste@chu-metropole.fr' },
    update: {},
    create: {
      name: 'Marie Dupont',
      email: 'analyste@chu-metropole.fr',
      passwordHash: analysteHash,
      role: UserRole.ANALYSTE,
    },
  })

  const riskManager = await prisma.user.upsert({
    where: { email: 'rssi@chu-metropole.fr' },
    update: {},
    create: {
      name: 'Jean-Marc Leroi',
      email: 'rssi@chu-metropole.fr',
      passwordHash: rmHash,
      role: 'RSSI' as UserRole,
    },
  })

  console.log(`✅ Utilisateurs créés : ${admin.email}, ${analyste.email}, ${riskManager.email}`)

  // ── Échelle commune de l'organisation (singleton global) ─────────────────
  await prisma.configuration.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      nbNiveaux: 4,
      echelleGravite: DEFAULT_ECHELLE_GRAVITE,
      echelleVraisemblance: DEFAULT_ECHELLE_VRAISEMBLANCE,
      seuilsMatrice: DEFAULT_SEUILS_MATRICE,
    },
  })

  // ── Analyse de démonstration ──────────────────────────────────────────────
  // Vérifie si l'analyse demo existe déjà
  const existingAnalyse = await prisma.analyse.findFirst({
    where: { userId: analyste.id, nom: 'CHU Métropole — Sécurité SI Patient' },
  })

  if (existingAnalyse) {
    console.log('ℹ️  Analyse de démo déjà présente — seed ignoré pour cette analyse.')
    return
  }

  const analyse = await prisma.analyse.create({
    data: {
      userId: analyste.id,
      nom: 'CHU Métropole — Sécurité SI Patient',
      description:
        'Analyse des risques EBIOS RM portant sur le système d\'information de santé du CHU Métropole. ' +
        'Périmètre : dossier patient informatisé (DPI), imagerie médicale (PACS), pharmacie automatisée et urgences.',
      organisation: 'CHU Métropole',
      secteur: 'Santé / Hôpital public',
      statut: 'EN_COURS',
      atelierCourant: 3,
    },
  })

  // ── Atelier 1 — Cadrage ───────────────────────────────────────────────────

  await prisma.cadrage.create({
    data: {
      analyseId: analyse.id,

      perimetre:
        'Le périmètre couvre l\'ensemble du Système d\'Information de Santé (SIS) du CHU Métropole, ' +
        'incluant les applications cliniques, l\'infrastructure réseau et les interconnexions avec les partenaires de soins.',

      objectifsEtude:
        'Identifier et évaluer les risques pesant sur la confidentialité, l\'intégrité et la disponibilité ' +
        'des données patient et des systèmes de soins critiques. Définir un plan de traitement priorisé.',

      missions:
        'Soins hospitaliers (médecine, chirurgie, urgences, réanimation) • ' +
        'Recherche médicale et enseignement • ' +
        'Gestion administrative des patients • ' +
        'Coordination avec les établissements de soins du territoire.',

      valeursMetier: [
        {
          id: VM_DOSSIER,
          nom: 'Dossier Patient Informatisé (DPI)',
          type: 'PROCESSUS',
          description: 'Ensemble des informations médicales du patient : antécédents, diagnostics, prescriptions, comptes-rendus.',
          responsable: 'Direction des Systèmes d\'Information',
          missionRef: 'Soins hospitaliers',
          criteres: { disponibilite: 4, integrite: 4, confidentialite: 4 },
        },
        {
          id: VM_IMAGERIE,
          nom: 'Imagerie médicale (PACS/RIS)',
          type: 'SYSTEME',
          description: 'Archivage et communication des images radiologiques (radio, scanner, IRM, échographie).',
          responsable: 'Service Radiologie',
          missionRef: 'Soins hospitaliers',
          criteres: { disponibilite: 4, integrite: 4, confidentialite: 3 },
        },
        {
          id: VM_PHARMACIE,
          nom: 'Circuit du médicament',
          type: 'PROCESSUS',
          description: 'Prescription, dispensation et administration des médicaments via le logiciel de pharmacie automatisée.',
          responsable: 'Pharmacie centrale',
          missionRef: 'Soins hospitaliers',
          criteres: { disponibilite: 4, integrite: 4, confidentialite: 3 },
        },
        {
          id: VM_URGENCES,
          nom: 'Service des urgences',
          type: 'SERVICE',
          description: 'Prise en charge des patients en urgence 24h/24, accès temps-réel aux antécédents et prescriptions.',
          responsable: 'Chef de service Urgences',
          missionRef: 'Soins hospitaliers',
          criteres: { disponibilite: 4, integrite: 3, confidentialite: 3 },
        },
      ],

      biensSupports: [
        {
          id: BS_SIH,
          nom: 'Système d\'Information Hospitalier (SIH)',
          type: 'LOGICIEL',
          description: 'Application centrale DPI — éditeur MediSoft v8.3',
          valeursMétierIds: [VM_DOSSIER, VM_URGENCES, VM_PHARMACIE],
        },
        {
          id: BS_PACS,
          nom: 'Serveur PACS',
          type: 'MATERIEL',
          description: 'Serveur d\'archivage des images médicales — Orthanc + Viewer 3D',
          valeursMétierIds: [VM_IMAGERIE],
        },
        {
          id: BS_RESEAU,
          nom: 'Infrastructure réseau LAN/WAN',
          type: 'RESEAU',
          description: 'Réseau interne VLAN hospitalier + accès VPN professionnels de santé externes',
          valeursMétierIds: [VM_DOSSIER, VM_IMAGERIE, VM_PHARMACIE, VM_URGENCES],
        },
        {
          id: BS_AD,
          nom: 'Active Directory / Gestion des identités',
          type: 'LOGICIEL',
          description: 'Contrôleur de domaine Windows Server 2022 — authentification centralisée',
          valeursMétierIds: [VM_DOSSIER, VM_IMAGERIE, VM_PHARMACIE, VM_URGENCES],
        },
        {
          id: BS_SAUVEGARDE,
          nom: 'Système de sauvegarde',
          type: 'MATERIEL',
          description: 'Solution Veeam Backup — sauvegardes nuit + réplication site distant',
          valeursMétierIds: [VM_DOSSIER, VM_IMAGERIE],
        },
      ],

      evenementsRedoutes: [
        {
          id: ER_FUITE,
          valeurMetierId: VM_DOSSIER,
          description: 'Divulgation non autorisée de données médicales patients à des tiers',
          impacts: [
            'Atteinte à la vie privée des patients',
            'Violation du secret médical (sanctions CNIL/ANSM)',
            'Perte de confiance des patients envers l\'établissement',
            'Risque de chantage ou usurpation d\'identité',
          ],
          gravite: 4,
        },
        {
          id: ER_INDISPO,
          valeurMetierId: VM_URGENCES,
          description: 'Indisponibilité des systèmes de soins critiques (DPI, circuit médicament)',
          impacts: [
            'Retard dans la prise en charge des urgences vitales',
            'Erreurs médicamenteuses par perte d\'accès aux antécédents',
            'Surcharge opérationnelle et passage en mode dégradé papier',
            'Mise en danger potentielle de patients',
          ],
          gravite: 4,
        },
        {
          id: ER_ALTERATION,
          valeurMetierId: VM_PHARMACIE,
          description: 'Altération silencieuse des données de prescription médicamenteuse',
          impacts: [
            'Administration de mauvaise posologie ou mauvais médicament',
            'Préjudice grave voire mortel pour les patients',
            'Responsabilité pénale des praticiens',
          ],
          gravite: 4,
        },
      ],

      referentiels: [
        { nom: 'ISO 27001:2022', version: '2022', applicable: true, ecarts: 'Absence de SMSI formalisé' },
        { nom: 'HDS (Hébergeur de Données de Santé)', version: '2018', applicable: true, ecarts: 'Certification en cours' },
        { nom: 'PGSSI-S ANSSI', version: '2023', applicable: true, ecarts: 'Politique MFA non déployée sur tous les accès' },
        { nom: 'RGPD', version: 'Règl. 2016/679', applicable: true, ecarts: 'Registre des traitements incomplet' },
      ],

      socleSecurite: [
        { id: id(), mesure: 'Authentification multi-facteur pour les accès VPN', source: 'PGSSI-S', statut: 'A_FAIRE' },
        { id: id(), mesure: 'Chiffrement des données au repos (DPI, PACS)', source: 'HDS', statut: 'EN_COURS' },
        { id: id(), mesure: 'Segmentation réseau (VLAN clinique / administratif / IoT médical)', source: 'ISO 27001', statut: 'REALISE' },
        { id: id(), mesure: 'Plan de reprise d\'activité (PRA) documenté et testé', source: 'PGSSI-S', statut: 'EN_COURS' },
        { id: id(), mesure: 'Gestion des correctifs (patching mensuel)', source: 'ISO 27001', statut: 'A_FAIRE' },
      ],
    },
  })

  // ── Atelier 2 — Sources de risque ─────────────────────────────────────────

  await prisma.sourceRisque.createMany({
    data: [
      {
        id: SR_CYBER,
        analyseId: analyse.id,
        nom: 'Cybercriminel / Ransomware-as-a-Service',
        categorie: 'CYBERCRIMINEL',
        description:
          'Groupes cybercriminels spécialisés dans les rançongiciels ciblant le secteur hospitalier. ' +
          'Nombreux incidents en France (CH Corbeil, CH Versailles, AP-HP).',
        motivationScore: 4,
        ressourcesScore: 3,
        activiteScore: 4,
        pertinence: 4,
        retenu: true,
        justification: 'Secteur santé premier ciblé en France. Gains financiers élevés et criticité des données.',
        objectifsVises: [
          {
            id: id(), nom: 'Extorsion financière via chiffrement du SIH',
            description: 'Chiffrement complet du SIH + demande de rançon pour déchiffrement',
            priorite: 'P1', pertinenceOV: 4,
          },
          {
            id: id(), nom: 'Exfiltration et vente de données patients',
            description: 'Vol de données médicales revendues sur le dark web ou utilisées pour double extorsion',
            priorite: 'P1', pertinenceOV: 3,
          },
        ],
      },
      {
        id: SR_INTERNE,
        analyseId: analyse.id,
        nom: 'Employé malveillant / Accès abusif',
        categorie: 'EMPLOYE_MALVEILLANT',
        description:
          'Personnel hospitalier (médecin, IDE, technicien SI) ayant des accès légitimes mais les utilisant à des fins malveillantes.',
        motivationScore: 2,
        ressourcesScore: 2,
        activiteScore: 2,
        pertinence: 2,
        retenu: true,
        justification: 'Risque réel mais atténué par les contrôles d\'accès existants. Incidents passés avec consultation abusive de dossiers VIP.',
        objectifsVises: [
          {
            id: id(), nom: 'Accès non autorisé à des dossiers VIP / célébrités',
            description: 'Consultation de dossiers de patients célèbres à des fins de curiosité ou de revente',
            priorite: 'P2', pertinenceOV: 3,
          },
        ],
      },
      {
        id: SR_APT,
        analyseId: analyse.id,
        nom: 'Groupe APT étatique',
        categorie: 'ETAT_NATION',
        description:
          'Acteur étatique (APT) cherchant à accéder aux données de recherche médicale ou à perturber les services de santé publique.',
        motivationScore: 3,
        ressourcesScore: 4,
        activiteScore: 2,
        pertinence: 3,
        retenu: true,
        justification: 'Le CHU mène des activités de recherche sur des pathologies sensibles. Les APT ciblent les données de recherche.',
        objectifsVises: [
          {
            id: id(), nom: 'Espionnage des programmes de recherche médicale',
            description: 'Accès aux données de recherche clinique non publiées et aux essais thérapeutiques',
            priorite: 'P2', pertinenceOV: 3,
          },
        ],
      },
    ],
  })

  // ── Atelier 3 — Scénarios stratégiques + parties prenantes ───────────────

  await prisma.partiePrenante.createMany({
    data: [
      {
        id: PP_BIOMEDICAL,
        analyseId: analyse.id,
        nom: 'Prestataire de maintenance biomédicale',
        type: 'PRESTATAIRE',
        description: 'Société externe assurant la maintenance des équipements biomédicaux connectés (moniteurs, pompes, robots chirurgicaux).',
        dependance: 3, penetration: 3, maturite: 2, confiance: 2, // expo 9 / fiab 4 → contrôle
        exposition: 9,
        fiabilite: 4,
      },
      {
        id: PP_EDITEUR,
        analyseId: analyse.id,
        nom: 'Éditeur SIH (MediSoft)',
        type: 'FOURNISSEUR',
        description: 'Éditeur du logiciel DPI principal — accès à distance pour télémaintenance et mises à jour.',
        dependance: 4, penetration: 4, maturite: 3, confiance: 2, // expo 16 / fiab 6 → contrôle
        exposition: 16,
        fiabilite: 6,
      },
      {
        id: PP_LABO,
        analyseId: analyse.id,
        nom: 'Laboratoires d\'analyses extérieurs',
        type: 'PARTENAIRE',
        description: 'Labos partenaires qui échangent des résultats d\'analyses via messagerie sécurisée de santé (MSSanté).',
        dependance: 2, penetration: 2, maturite: 3, confiance: 3, // expo 4 / fiab 9 → hors-périmètre
        exposition: 4,
        fiabilite: 9,
      },
    ],
  })

  await prisma.scenarioStrategique.createMany({
    data: [
      {
        id: SS_RANSOMWARE,
        analyseId: analyse.id,
        nom: 'Ransomware via prestataire compromis',
        sourceRisqueId: SR_CYBER,
        objectifVise: 'Extorsion financière via chiffrement du SIH',
        description:
          'Un groupe cybercriminel compromet le poste d\'un technicien du prestataire de maintenance biomédicale. ' +
          'Via l\'accès VPN légitime de ce prestataire, il pivote vers le réseau interne, élève ses privilèges dans l\'Active Directory ' +
          'et déploie un ransomware qui chiffre le SIH, le PACS et les sauvegardes en ligne.',
        evenementRedouteRef: ER_INDISPO,
        cheminAttaque: [
          { etape: 1, partiePrenante: 'Prestataire biomédicale', action: 'Phishing ciblé sur employé', evenementIntermediaire: 'Compromission du poste technicien' },
          { etape: 2, partiePrenante: 'Réseau CHU via VPN', action: 'Connexion VPN avec credentials volés', evenementIntermediaire: 'Accès au segment réseau médical' },
          { etape: 3, partiePrenante: 'Active Directory', action: 'Kerberoasting + Pass-the-Hash', evenementIntermediaire: 'Élévation de privilèges Administrateur de domaine' },
          { etape: 4, partiePrenante: 'SIH / PACS / Sauvegardes', action: 'Déploiement ransomware', evenementIntermediaire: 'Chiffrement de tous les systèmes critiques' },
        ],
        mesuresEcosysteme: [
          { id: id(), partiePrenante: 'Prestataire biomédicale', mesure: 'Exiger certification ISO 27001 des prestataires', type: 'ORGANISATIONNELLE', statut: 'A_FAIRE' },
          { id: id(), partiePrenante: 'Éditeur SIH', mesure: 'Accès télémaintenance via bastion dédié (PAM)', type: 'TECHNIQUE', statut: 'EN_COURS' },
        ],
        vraisemblance: 3,
        gravite: 4,
        niveauRisque: 12,
        retenu: true,
      },
      {
        id: SS_EXFIL,
        analyseId: analyse.id,
        nom: 'Exfiltration de données via messagerie médicale compromise',
        sourceRisqueId: SR_APT,
        objectifVise: 'Espionnage des programmes de recherche médicale',
        description:
          'Un acteur APT exploite une vulnérabilité dans la passerelle MSSanté ou compromet un compte utilisateur ' +
          'avec accès aux données de recherche. Il exfiltre silencieusement les dossiers des patients participant ' +
          'aux essais cliniques sur plusieurs mois.',
        evenementRedouteRef: ER_FUITE,
        cheminAttaque: [
          { etape: 1, partiePrenante: 'Laboratoire partenaire', action: 'Spear-phishing chercheur', evenementIntermediaire: 'Compromission compte messagerie médicale' },
          { etape: 2, partiePrenante: 'SIH — module recherche', action: 'Accès légitime via compte compromis', evenementIntermediaire: 'Accès base de données essais cliniques' },
          { etape: 3, partiePrenante: 'Infrastructure externe', action: 'Exfiltration progressive chiffrée (DNS/HTTPS)', evenementIntermediaire: 'Fuite silencieuse sur 3-6 mois' },
        ],
        mesuresEcosysteme: [
          { id: id(), partiePrenante: 'Laboratoires partenaires', mesure: 'Formation anti-phishing ciblée chercheurs', type: 'ORGANISATIONNELLE', statut: 'A_FAIRE' },
        ],
        vraisemblance: 2,
        gravite: 3,
        niveauRisque: 6,
        retenu: true,
      },
    ],
  })

  // ── Atelier 4 — Scénarios opérationnels ──────────────────────────────────

  await prisma.scenarioOperationnel.createMany({
    data: [
      {
        id: SO_PHISHING,
        analyseId: analyse.id,
        nom: 'Phishing ciblé employé prestataire → mouvement latéral',
        scenarioStrategiqueId: SS_RANSOMWARE,
        description:
          'Email de phishing imitant une alerte de renouvellement VPN envoyé au technicien biomédical. ' +
          'Credential harvesting puis mouvement latéral vers le domaine hospitalier.',
        actionsElementaires: [
          {
            id: id(), nom: 'Email phishing credential harvesting',
            type: 'SOCIAL_ENGINEERING',
            bienSupport: 'Poste technicien biomédicale',
            vulnerabilite: 'Absence de formation anti-phishing spécifique prestataires',
            description: 'Email imitant portail VPN CHU — formulaire de connexion frauduleux',
          },
          {
            id: id(), nom: 'Connexion VPN avec credentials volés',
            type: 'ACCES_INITIAL',
            bienSupport: BS_RESEAU,
            vulnerabilite: 'VPN sans MFA — authentification simple par login/mot de passe',
            description: 'Connexion au concentrateur VPN Cisco avec les identifiants du technicien',
          },
          {
            id: id(), nom: 'Reconnaissance réseau interne',
            type: 'RECONNAISSANCE',
            bienSupport: BS_RESEAU,
            vulnerabilite: 'Absence de segmentation fine du VLAN prestataires',
            description: 'Scan Nmap du réseau, identification des contrôleurs de domaine et serveurs SIH',
          },
          {
            id: id(), nom: 'Kerberoasting Active Directory',
            type: 'ELEVATION_PRIVILEGES',
            bienSupport: BS_AD,
            vulnerabilite: 'Comptes de service AD avec SPN configurés et mots de passe faibles',
            description: 'Demande de tickets TGS pour comptes de service, crackage offline des hashes Kerberos',
          },
          {
            id: id(), nom: 'Déploiement ransomware via GPO',
            type: 'IMPACT',
            bienSupport: BS_SIH,
            vulnerabilite: 'Droits d\'écriture GPO non restreints après compromission Admin de domaine',
            description: 'Script PowerShell déployé via stratégie de groupe pour chiffrer tous les postes et serveurs',
          },
        ],
        vraisemblance: 3,
        gravite: 4,
      },
      {
        id: SO_VULN_VPN,
        analyseId: analyse.id,
        nom: 'Exploitation CVE sur concentrateur VPN → accès direct',
        scenarioStrategiqueId: SS_RANSOMWARE,
        description:
          'Exploitation d\'une vulnérabilité critique (ex: CVE-2024-XXXXX) sur le concentrateur VPN Cisco ' +
          'permettant une exécution de code à distance sans authentification préalable.',
        actionsElementaires: [
          {
            id: id(), nom: 'Reconnaissance du concentrateur VPN exposé',
            type: 'RECONNAISSANCE',
            bienSupport: BS_RESEAU,
            vulnerabilite: 'Concentrateur VPN directement exposé sur Internet sans WAF',
            description: 'Shodan/Censys — identification de la version du firmware vulnérable',
          },
          {
            id: id(), nom: 'Exploitation RCE sur le concentrateur VPN',
            type: 'EXPLOITATION',
            bienSupport: BS_RESEAU,
            vulnerabilite: 'Patch non appliqué — délai moyen patching > 45 jours',
            description: 'Exploitation du CVE via requête HTTP malformée, obtention d\'un shell root sur le concentrateur',
          },
          {
            id: id(), nom: 'Pivot vers le réseau interne hospitalier',
            type: 'MOUVEMENT_LATERAL',
            bienSupport: BS_AD,
            vulnerabilite: 'Le concentrateur VPN a accès au réseau d\'administration — pas de micro-segmentation',
            description: 'Utilisation du concentrateur compromis comme point de rebond vers l\'AD et les serveurs SIH',
          },
        ],
        vraisemblance: 2,
        gravite: 4,
      },
    ],
  })

  // ── Atelier 5 — Risques et mesures ───────────────────────────────────────

  await prisma.risque.createMany({
    data: [
      {
        id: R_RANSOMWARE,
        analyseId: analyse.id,
        nom: 'Indisponibilité totale du SIS par ransomware',
        scenarioOpId: SO_PHISHING,
        description:
          'Déploiement d\'un ransomware via prestataire compromis entraînant le chiffrement du SIH, PACS et sauvegardes. ' +
          'Passage en mode dégradé papier estimé à 2-4 semaines.',
        gravite: 4,
        vraisemblance: 3,
        niveauRisque: 12,
        strategie: 'REDUIRE',
        evenementRedouteRef: 'Indisponibilité des systèmes de soins critiques',
        vulnerabilitesResiduelles: [
          { description: 'Sauvegardes en ligne potentiellement chiffrées', niveau: 3 },
          { description: 'Dépendance à un seul Active Directory', niveau: 3 },
        ],
        facteursAggravants: [
          { description: 'Absence de MFA sur les accès VPN prestataires' },
          { description: 'Segmentation réseau insuffisante (VLAN prestataires non isolé)' },
          { description: 'Délai de patching trop long (> 45 jours)' },
        ],
        graviteResiduelle: 4,
        vraisemblanceResiduelle: 2,
        niveauResiduel: 8,
        justificationResiduelle:
          'Après mise en place du MFA, du bastion et de la sauvegarde offline, la vraisemblance diminue de 3→2. ' +
          'La gravite reste critique compte tenu de l\'impact patient potentiel.',
      },
      {
        id: R_FUITE_DATA,
        analyseId: analyse.id,
        nom: 'Exfiltration de données patients et de recherche',
        scenarioOpId: SO_VULN_VPN,
        description:
          'Compromission silencieuse permettant l\'exfiltration de dossiers patients et de données d\'essais cliniques ' +
          'pendant plusieurs semaines sans détection.',
        gravite: 3,
        vraisemblance: 2,
        niveauRisque: 6,
        strategie: 'REDUIRE',
        evenementRedouteRef: 'Divulgation non autorisée de données médicales patients',
        vulnerabilitesResiduelles: [
          { description: 'Absence de DLP (Data Loss Prevention) sur les flux sortants', niveau: 3 },
          { description: 'Journalisation insuffisante des accès aux données de recherche', niveau: 2 },
        ],
        facteursAggravants: [
          { description: 'Données de recherche hautement sensibles et valorisables' },
          { description: 'SIEM non déployé — détection tardive des exfiltrations lentes' },
        ],
        graviteResiduelle: 3,
        vraisemblanceResiduelle: 1,
        niveauResiduel: 3,
        justificationResiduelle:
          'Avec déploiement SIEM + DLP, la vraisemblance tombe à 1 (détection précoce). ' +
          'La gravité reste à 3 en raison des données de recherche sensibles.',
      },
    ],
  })

  await prisma.mesure.createMany({
    data: [
      {
        id: M1,
        analyseId: analyse.id,
        risqueId: R_RANSOMWARE,
        nom: 'Déploiement MFA sur tous les accès VPN',
        description: 'Mise en place d\'une authentification à deux facteurs (TOTP ou carte à puce) pour tous les accès VPN, prestataires inclus.',
        type: 'PREVENTIVE',
        priorite: 4,
        statut: 'EN_COURS',
        responsable: 'DSI — équipe réseau',
        efficacite: 4,
      },
      {
        id: M2,
        analyseId: analyse.id,
        risqueId: R_RANSOMWARE,
        nom: 'Bastion PAM pour les accès prestataires (CyberArk / Bastion WALLIX)',
        description:
          'Déploiement d\'un Privileged Access Management pour tous les accès distants des prestataires. ' +
          'Enregistrement de session, rotation automatique des mots de passe, approbation par ticket.',
        type: 'PREVENTIVE',
        priorite: 4,
        statut: 'A_FAIRE',
        responsable: 'DSI — Sécurité',
        efficacite: 4,
      },
      {
        id: M3,
        analyseId: analyse.id,
        risqueId: R_RANSOMWARE,
        nom: 'Sauvegarde offline immutable (règle 3-2-1-1)',
        description:
          'Mise en place de sauvegardes immuables hors-ligne (air-gap ou Object Lock S3). ' +
          'Règle 3-2-1-1 : 3 copies, 2 supports différents, 1 hors-site, 1 immuable. ' +
          'Test de restauration mensuel obligatoire.',
        type: 'CORRECTIVE',
        priorite: 4,
        statut: 'A_FAIRE',
        responsable: 'DSI — Exploitation',
        efficacite: 3,
      },
      {
        id: M4,
        analyseId: analyse.id,
        risqueId: R_FUITE_DATA,
        nom: 'Déploiement SIEM + SOC externalisé 24/7',
        description:
          'Mise en place d\'un Security Information and Event Management (Splunk ou Elastic SIEM) ' +
          'avec corrélation des logs SIH, AD, VPN et réseau. ' +
          'Supervision externalisée par un SOC 24/7 avec SLA de détection < 1h.',
        type: 'DETECTIVE',
        priorite: 3,
        statut: 'A_FAIRE',
        responsable: 'RSSI',
        efficacite: 4,
      },
      {
        id: M5,
        analyseId: analyse.id,
        risqueId: R_FUITE_DATA,
        nom: 'Solution DLP sur les flux sortants (email, cloud, USB)',
        description:
          'Déploiement d\'un outil Data Loss Prevention pour détecter et bloquer l\'exfiltration ' +
          'de données sensibles via email, transfert cloud ou périphériques amovibles.',
        type: 'PREVENTIVE',
        priorite: 3,
        statut: 'A_FAIRE',
        responsable: 'DSI — Sécurité',
        efficacite: 3,
      },
    ],
  })

  console.log(`✅ Analyse de démo créée : "${analyse.nom}" (id: ${analyse.id})`)
  console.log('✅ Atelier 1 (Cadrage) — 4 valeurs métier, 5 biens supports, 3 ER')
  console.log('✅ Atelier 2 (Sources de risque) — 3 sources retenues')
  console.log('✅ Atelier 3 (Scénarios stratégiques) — 3 PP, 2 scénarios')
  console.log('✅ Atelier 4 (Scénarios opérationnels) — 2 scénarios, 8 AE')
  console.log('✅ Atelier 5 (Traitement) — 2 risques, 5 mesures')
  console.log('')
  console.log('🔑 Comptes de démo (politique ANSSI — 12 car. min, complexité complète) :')
  console.log('   admin@chu-metropole.fr    / Acra@Admin2024!   (ADMIN)')
  console.log('   analyste@chu-metropole.fr / Acra@Analyste24!  (ANALYSTE)')
  console.log('   rssi@chu-metropole.fr     / Acra@Rssi2024!!   (RSSI)')
}

main()
  .catch((e) => {
    console.error('❌ Seed échoué :', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
