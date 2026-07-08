/**
 * demo-example.ts — Génère un exemple d'analyse EBIOS RM complet (5 ateliers) dans
 * l'organisation d'un testeur du site de démonstration (ACRA-Demo).
 *
 * Décision produit : l'organisation démo est VIDE à la création ; le testeur clique
 * « charger un exemple » pour voir une analyse entièrement renseignée qu'il peut
 * ensuite explorer/éditer. Contenu condensé mais représentatif (thème CHU), dérivé
 * du seed de démonstration. Chaque appel génère des identifiants neufs → indépendant.
 *
 * Server-only (Prisma). Gardé côté API par `isDemoInstance()`.
 */
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'node:crypto'

/** Identifiant opaque pour les références internes JSON (aligné sur le seed). */
function id(): string {
  return randomBytes(8).toString('hex')
}

/** Nom de l'exemple — sert aussi de garde anti-doublon (un seul exemple par org). */
export const DEMO_EXAMPLE_NAME = 'CHU Métropole — Exemple guidé'

/**
 * Crée l'analyse exemple dans l'organisation donnée pour l'utilisateur donné.
 * Idempotent par organisation : si un exemple existe déjà dans l'org, renvoie
 * l'existant sans le recréer.
 */
export async function createExampleAnalyse(
  userId: string,
  organizationId?: string | null,
): Promise<{ id: string; nom: string; alreadyExisted: boolean }> {
  // Anti-doublon : un seul exemple par organisation (le testeur peut relancer sans risque).
  const existing = await prisma.analyse.findFirst({
    where: { organizationId: organizationId ?? undefined, nom: DEMO_EXAMPLE_NAME },
    select: { id: true, nom: true },
  })
  if (existing) return { ...existing, alreadyExisted: true }

  // Références internes (valeurs métier, biens supports, événements redoutés, etc.).
  const VM_DOSSIER = id(), VM_PHARMACIE = id(), VM_URGENCES = id()
  const BS_SIH = id(), BS_RESEAU = id(), BS_AD = id(), BS_SAUVEGARDE = id()
  const ER_FUITE = id(), ER_INDISPO = id(), ER_ALTERATION = id()
  const SR_CYBER = id(), SR_APT = id()
  const PP_BIOMEDICAL = id(), PP_EDITEUR = id()
  const SS_RANSOMWARE = id(), SS_EXFIL = id()
  const SO_PHISHING = id(), SO_VULN_VPN = id()
  const R_RANSOMWARE = id(), R_FUITE_DATA = id()

  const analyse = await prisma.analyse.create({
    data: {
      userId,
      organizationId: organizationId ?? undefined,
      nom: DEMO_EXAMPLE_NAME,
      description:
        'Exemple d\'analyse de risques EBIOS RM (secteur santé) fourni pour la démonstration. ' +
        'Explorez les 5 ateliers puis modifiez-le librement — il s\'agit de données fictives.',
      organisation: 'CHU Métropole',
      secteur: 'Santé / Hôpital public',
      statut: 'EN_COURS',
      atelierCourant: 5,
    },
    select: { id: true, nom: true },
  })

  // ── Atelier 1 — Cadrage ────────────────────────────────────────────────────
  await prisma.cadrage.create({
    data: {
      analyseId: analyse.id,
      perimetre:
        'Système d\'Information de Santé (SIS) du CHU Métropole : applications cliniques, ' +
        'infrastructure réseau et interconnexions avec les partenaires de soins.',
      objectifsEtude:
        'Identifier et évaluer les risques pesant sur la confidentialité, l\'intégrité et la ' +
        'disponibilité des données patient et des systèmes de soins critiques.',
      missions:
        'Soins hospitaliers (urgences, réanimation) • Recherche médicale • ' +
        'Gestion administrative des patients.',
      valeursMetier: [
        {
          id: VM_DOSSIER, nom: 'Dossier Patient Informatisé (DPI)', type: 'PROCESSUS',
          description: 'Informations médicales du patient : antécédents, diagnostics, prescriptions.',
          responsable: 'Direction des Systèmes d\'Information', missionRef: 'Soins hospitaliers',
          criteres: { disponibilite: 4, integrite: 4, confidentialite: 4 },
        },
        {
          id: VM_PHARMACIE, nom: 'Circuit du médicament', type: 'PROCESSUS',
          description: 'Prescription, dispensation et administration des médicaments.',
          responsable: 'Pharmacie centrale', missionRef: 'Soins hospitaliers',
          criteres: { disponibilite: 4, integrite: 4, confidentialite: 3 },
        },
        {
          id: VM_URGENCES, nom: 'Service des urgences', type: 'SERVICE',
          description: 'Prise en charge 24h/24, accès temps-réel aux antécédents et prescriptions.',
          responsable: 'Chef de service Urgences', missionRef: 'Soins hospitaliers',
          criteres: { disponibilite: 4, integrite: 3, confidentialite: 3 },
        },
      ],
      biensSupports: [
        {
          id: BS_SIH, nom: 'Système d\'Information Hospitalier (SIH)', type: 'LOGICIEL',
          description: 'Application centrale DPI', valeursMétierIds: [VM_DOSSIER, VM_URGENCES, VM_PHARMACIE],
        },
        {
          id: BS_RESEAU, nom: 'Infrastructure réseau LAN/WAN', type: 'RESEAU',
          description: 'Réseau interne VLAN hospitalier + accès VPN', valeursMétierIds: [VM_DOSSIER, VM_PHARMACIE, VM_URGENCES],
        },
        {
          id: BS_AD, nom: 'Active Directory', type: 'LOGICIEL',
          description: 'Authentification centralisée Windows Server', valeursMétierIds: [VM_DOSSIER, VM_PHARMACIE, VM_URGENCES],
        },
        {
          id: BS_SAUVEGARDE, nom: 'Système de sauvegarde', type: 'MATERIEL',
          description: 'Solution de sauvegarde + réplication site distant', valeursMétierIds: [VM_DOSSIER],
        },
      ],
      evenementsRedoutes: [
        {
          id: ER_FUITE, valeurMetierId: VM_DOSSIER,
          description: 'Divulgation non autorisée de données médicales patients',
          impacts: ['Atteinte à la vie privée', 'Violation du secret médical', 'Perte de confiance des patients'],
          gravite: 4,
        },
        {
          id: ER_INDISPO, valeurMetierId: VM_URGENCES,
          description: 'Indisponibilité des systèmes de soins critiques',
          impacts: ['Retard de prise en charge des urgences vitales', 'Passage en mode dégradé papier'],
          gravite: 4,
        },
        {
          id: ER_ALTERATION, valeurMetierId: VM_PHARMACIE,
          description: 'Altération silencieuse des prescriptions médicamenteuses',
          impacts: ['Erreur de posologie', 'Préjudice grave pour les patients'],
          gravite: 4,
        },
      ],
      referentiels: [
        { nom: 'ISO 27001:2022', version: '2022', applicable: true, ecarts: 'Absence de SMSI formalisé' },
        { nom: 'HDS (Hébergeur de Données de Santé)', version: '2018', applicable: true, ecarts: 'Certification en cours' },
        { nom: 'RGPD', version: 'Règl. 2016/679', applicable: true, ecarts: 'Registre des traitements incomplet' },
      ],
      socleSecurite: [
        { id: id(), mesure: 'Authentification multi-facteur pour les accès VPN', source: 'PGSSI-S', statut: 'A_FAIRE' },
        { id: id(), mesure: 'Chiffrement des données au repos (DPI)', source: 'HDS', statut: 'EN_COURS' },
        { id: id(), mesure: 'Segmentation réseau (VLAN clinique / administratif)', source: 'ISO 27001', statut: 'REALISE' },
      ],
    },
  })

  // ── Atelier 2 — Sources de risque ──────────────────────────────────────────
  await prisma.sourceRisque.createMany({
    data: [
      {
        id: SR_CYBER, analyseId: analyse.id, nom: 'Cybercriminel / Ransomware-as-a-Service',
        categorie: 'CYBERCRIMINEL',
        description: 'Groupes cybercriminels ciblant le secteur hospitalier (rançongiciels).',
        motivationScore: 4, ressourcesScore: 3, activiteScore: 4, pertinence: 4, retenu: true,
        justification: 'Secteur santé premier ciblé en France. Gains financiers élevés.',
        objectifsVises: [
          { id: id(), nom: 'Extorsion financière via chiffrement du SIH', description: 'Chiffrement complet + rançon', priorite: 'P1', pertinenceOV: 4 },
          { id: id(), nom: 'Exfiltration et vente de données patients', description: 'Double extorsion', priorite: 'P1', pertinenceOV: 3 },
        ],
      },
      {
        id: SR_APT, analyseId: analyse.id, nom: 'Groupe APT étatique',
        categorie: 'ETAT_NATION',
        description: 'Acteur étatique cherchant à accéder aux données de recherche médicale.',
        motivationScore: 3, ressourcesScore: 4, activiteScore: 2, pertinence: 3, retenu: true,
        justification: 'Le CHU mène des activités de recherche sur des pathologies sensibles.',
        objectifsVises: [
          { id: id(), nom: 'Espionnage des programmes de recherche médicale', description: 'Accès aux essais cliniques non publiés', priorite: 'P2', pertinenceOV: 3 },
        ],
      },
    ],
  })

  // ── Atelier 3 — Parties prenantes + scénarios stratégiques ──────────────────
  await prisma.partiePrenante.createMany({
    data: [
      {
        id: PP_BIOMEDICAL, analyseId: analyse.id, nom: 'Prestataire de maintenance biomédicale', type: 'PRESTATAIRE',
        description: 'Maintenance des équipements biomédicaux connectés.',
        dependance: 3, penetration: 3, maturite: 2, confiance: 2, exposition: 9, fiabilite: 4,
      },
      {
        id: PP_EDITEUR, analyseId: analyse.id, nom: 'Éditeur SIH', type: 'FOURNISSEUR',
        description: 'Éditeur du logiciel DPI — télémaintenance à distance.',
        dependance: 4, penetration: 4, maturite: 3, confiance: 2, exposition: 16, fiabilite: 6,
      },
    ],
  })

  await prisma.scenarioStrategique.createMany({
    data: [
      {
        id: SS_RANSOMWARE, analyseId: analyse.id, nom: 'Ransomware via prestataire compromis',
        sourceRisqueId: SR_CYBER, objectifVise: 'Extorsion financière via chiffrement du SIH',
        description:
          'Compromission du poste d\'un technicien prestataire, pivot via VPN, élévation de privilèges ' +
          'Active Directory puis déploiement d\'un ransomware chiffrant le SIH et les sauvegardes.',
        evenementRedouteRef: ER_INDISPO,
        cheminAttaque: [
          { etape: 1, partiePrenante: 'Prestataire biomédicale', action: 'Phishing ciblé', evenementIntermediaire: 'Compromission du poste technicien' },
          { etape: 2, partiePrenante: 'Réseau CHU via VPN', action: 'Connexion avec credentials volés', evenementIntermediaire: 'Accès au segment médical' },
          { etape: 3, partiePrenante: 'Active Directory', action: 'Élévation de privilèges', evenementIntermediaire: 'Admin de domaine' },
          { etape: 4, partiePrenante: 'SIH / Sauvegardes', action: 'Déploiement ransomware', evenementIntermediaire: 'Chiffrement des systèmes critiques' },
        ],
        mesuresEcosysteme: [
          { id: id(), partiePrenante: 'Prestataire biomédicale', mesure: 'Exiger la certification ISO 27001', type: 'ORGANISATIONNELLE', statut: 'A_FAIRE' },
          { id: id(), partiePrenante: 'Éditeur SIH', mesure: 'Télémaintenance via bastion (PAM)', type: 'TECHNIQUE', statut: 'EN_COURS' },
        ],
        vraisemblance: 3, gravite: 4, niveauRisque: 12, retenu: true,
      },
      {
        id: SS_EXFIL, analyseId: analyse.id, nom: 'Exfiltration de données via compte compromis',
        sourceRisqueId: SR_APT, objectifVise: 'Espionnage des programmes de recherche médicale',
        description:
          'Un acteur APT compromet un compte avec accès aux données de recherche et exfiltre ' +
          'silencieusement les dossiers d\'essais cliniques sur plusieurs mois.',
        evenementRedouteRef: ER_FUITE,
        cheminAttaque: [
          { etape: 1, partiePrenante: 'Chercheur', action: 'Spear-phishing', evenementIntermediaire: 'Compromission compte messagerie' },
          { etape: 2, partiePrenante: 'SIH — module recherche', action: 'Accès via compte compromis', evenementIntermediaire: 'Accès base essais cliniques' },
          { etape: 3, partiePrenante: 'Infrastructure externe', action: 'Exfiltration chiffrée progressive', evenementIntermediaire: 'Fuite silencieuse sur 3-6 mois' },
        ],
        mesuresEcosysteme: [
          { id: id(), partiePrenante: 'Chercheurs', mesure: 'Formation anti-phishing ciblée', type: 'ORGANISATIONNELLE', statut: 'A_FAIRE' },
        ],
        vraisemblance: 2, gravite: 3, niveauRisque: 6, retenu: true,
      },
    ],
  })

  // ── Atelier 4 — Scénarios opérationnels ─────────────────────────────────────
  await prisma.scenarioOperationnel.createMany({
    data: [
      {
        id: SO_PHISHING, analyseId: analyse.id, nom: 'Phishing prestataire → mouvement latéral',
        scenarioStrategiqueId: SS_RANSOMWARE,
        description: 'Email de phishing imitant une alerte VPN, credential harvesting puis mouvement latéral.',
        actionsElementaires: [
          { id: id(), nom: 'Email phishing credential harvesting', type: 'SOCIAL_ENGINEERING', bienSupport: 'Poste technicien', vulnerabilite: 'Absence de formation anti-phishing', description: 'Portail VPN frauduleux' },
          { id: id(), nom: 'Connexion VPN avec credentials volés', type: 'ACCES_INITIAL', bienSupport: BS_RESEAU, vulnerabilite: 'VPN sans MFA', description: 'Connexion au concentrateur VPN' },
          { id: id(), nom: 'Kerberoasting Active Directory', type: 'ELEVATION_PRIVILEGES', bienSupport: BS_AD, vulnerabilite: 'Comptes de service à mots de passe faibles', description: 'Crackage offline des hashes Kerberos' },
          { id: id(), nom: 'Déploiement ransomware via GPO', type: 'IMPACT', bienSupport: BS_SIH, vulnerabilite: 'Droits GPO non restreints', description: 'Chiffrement de tous les serveurs' },
        ],
        vraisemblance: 3, gravite: 4,
      },
      {
        id: SO_VULN_VPN, analyseId: analyse.id, nom: 'Exploitation CVE sur concentrateur VPN',
        scenarioStrategiqueId: SS_RANSOMWARE,
        description: 'Exploitation d\'une vulnérabilité critique du concentrateur VPN permettant une RCE non authentifiée.',
        actionsElementaires: [
          { id: id(), nom: 'Reconnaissance du VPN exposé', type: 'RECONNAISSANCE', bienSupport: BS_RESEAU, vulnerabilite: 'VPN exposé sans WAF', description: 'Identification du firmware vulnérable' },
          { id: id(), nom: 'Exploitation RCE', type: 'EXPLOITATION', bienSupport: BS_RESEAU, vulnerabilite: 'Patch non appliqué (> 45 j)', description: 'Shell root sur le concentrateur' },
          { id: id(), nom: 'Pivot vers le réseau interne', type: 'MOUVEMENT_LATERAL', bienSupport: BS_AD, vulnerabilite: 'Pas de micro-segmentation', description: 'Rebond vers AD et SIH' },
        ],
        vraisemblance: 2, gravite: 4,
      },
    ],
  })

  // ── Atelier 5 — Risques et mesures ──────────────────────────────────────────
  await prisma.risque.createMany({
    data: [
      {
        id: R_RANSOMWARE, analyseId: analyse.id, nom: 'Indisponibilité totale du SIS par ransomware',
        scenarioOpId: SO_PHISHING,
        description: 'Chiffrement du SIH et des sauvegardes ; mode dégradé papier estimé à 2-4 semaines.',
        gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE',
        evenementRedouteRef: 'Indisponibilité des systèmes de soins critiques',
        vulnerabilitesResiduelles: [
          { description: 'Sauvegardes en ligne potentiellement chiffrées', niveau: 3 },
          { description: 'Dépendance à un seul Active Directory', niveau: 3 },
        ],
        facteursAggravants: [
          { description: 'Absence de MFA sur les accès VPN prestataires' },
          { description: 'Délai de patching trop long (> 45 jours)' },
        ],
        graviteResiduelle: 4, vraisemblanceResiduelle: 2, niveauResiduel: 8,
        justificationResiduelle: 'Après MFA, bastion et sauvegarde offline, la vraisemblance passe de 3 à 2.',
      },
      {
        id: R_FUITE_DATA, analyseId: analyse.id, nom: 'Exfiltration de données patients et de recherche',
        scenarioOpId: SO_VULN_VPN,
        description: 'Exfiltration silencieuse de dossiers patients et de données d\'essais cliniques.',
        gravite: 3, vraisemblance: 2, niveauRisque: 6, strategie: 'REDUIRE',
        evenementRedouteRef: 'Divulgation non autorisée de données médicales patients',
        vulnerabilitesResiduelles: [
          { description: 'Absence de DLP sur les flux sortants', niveau: 3 },
          { description: 'Journalisation insuffisante des accès recherche', niveau: 2 },
        ],
        facteursAggravants: [
          { description: 'Données de recherche hautement valorisables' },
          { description: 'SIEM non déployé — détection tardive' },
        ],
        graviteResiduelle: 3, vraisemblanceResiduelle: 1, niveauResiduel: 3,
        justificationResiduelle: 'Avec SIEM + DLP, la vraisemblance tombe à 1 (détection précoce).',
      },
    ],
  })

  await prisma.mesure.createMany({
    data: [
      {
        id: id(), analyseId: analyse.id, risqueId: R_RANSOMWARE, nom: 'Déploiement MFA sur tous les accès VPN',
        description: 'Authentification à deux facteurs pour tous les accès VPN, prestataires inclus.',
        type: 'PREVENTIVE', priorite: 4, statut: 'EN_COURS', responsable: 'DSI — équipe réseau', efficacite: 4,
      },
      {
        id: id(), analyseId: analyse.id, risqueId: R_RANSOMWARE, nom: 'Bastion PAM pour les accès prestataires',
        description: 'Privileged Access Management : enregistrement de session, rotation des mots de passe.',
        type: 'PREVENTIVE', priorite: 4, statut: 'A_FAIRE', responsable: 'DSI — Sécurité', efficacite: 4,
      },
      {
        id: id(), analyseId: analyse.id, risqueId: R_RANSOMWARE, nom: 'Sauvegarde offline immuable (3-2-1-1)',
        description: 'Sauvegardes immuables hors-ligne (air-gap ou Object Lock) + test de restauration mensuel.',
        type: 'CORRECTIVE', priorite: 4, statut: 'A_FAIRE', responsable: 'DSI — Exploitation', efficacite: 3,
      },
      {
        id: id(), analyseId: analyse.id, risqueId: R_FUITE_DATA, nom: 'Déploiement SIEM + SOC 24/7',
        description: 'SIEM avec corrélation des logs SIH/AD/VPN + supervision SOC externalisée (SLA < 1h).',
        type: 'DETECTIVE', priorite: 3, statut: 'A_FAIRE', responsable: 'RSSI', efficacite: 4,
      },
    ],
  })

  return { id: analyse.id, nom: analyse.nom, alreadyExisted: false }
}
