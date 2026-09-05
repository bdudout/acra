/**
 * Catalogue des référentiels de mesures de sécurité supportés par ACRA.
 * Chaque référentiel expose un ensemble de contrôles utilisables dans les
 * Ateliers 3 (mesures écosystème) et 5 (plan de traitement).
 *
 * Référentiels inclus :
 *  • ISO 27001:2022 Annexe A       (93 contrôles)
 *  • NIST CSF 2.0                  (106 sous-catégories)
 *  • NIST SP 800-53 Rev 5          (~150 contrôles clés)
 *  • CIS Controls v8               (18 contrôles + safeguards clés)
 *  • ANSSI Guide d'hygiène v2      (42 mesures)
 *  • HDS (Hébergeur Données Santé) (30 exigences)
 *  • PCI-DSS v4.0                  (12 exigences × contrôles clés)
 *  • DORA (UE 2022/2554)           (5 piliers — banque/assurance/fintech)
 *  • IEC 62443 (+ ANSSI-PA-107)    (7 exigences fond. + zones/conduits — OT/ICS)
 *  • ReCyF (ANSSI 2026)            (20 objectifs — transposition NIS2 art. 21)
 *  • TISAX / VDA-ISA v6            (25 objectifs — filière automobile / OEM)
 *  • CUSTOM                        (contrôles définis par l'analyste)
 */
import type { Locale } from '@/lib/i18n'
import type { Domaine } from '@/lib/referentiel-domaines'
import { getEbiosData } from '@/lib/ebios-data-i18n'
import {
  DORA_CONTROLES, DORA_CATEGORIES,
  IEC_62443_CONTROLES, IEC_62443_CATEGORIES,
  SOC2_CONTROLES, SOC2_CATEGORIES,
  NIST_SSDF_CONTROLES, NIST_SSDF_CATEGORIES,
  RGS_CONTROLES, RGS_CATEGORIES,
  RECYF_CONTROLES, RECYF_CATEGORIES,
  TISAX_CONTROLES, TISAX_CATEGORIES,
  NIST_CSF_CONTROLES, NIST_CSF_CATEGORIES,
  CIS_V8_CONTROLES, CIS_V8_CATEGORIES,
  HDS_CONTROLES, HDS_CATEGORIES,
  PCI_DSS_CONTROLES, PCI_DSS_CATEGORIES,
  NIST_800_53_CONTROLES, NIST_800_53_CATEGORIES,
} from '@/lib/ebios-data'

// ─── Types partagés ───────────────────────────────────────────────────────────

export type ControlType = 'ORGANISATIONNELLE' | 'HUMAINE' | 'PHYSIQUE' | 'TECHNOLOGIQUE'

export interface FrameworkControl {
  ref: string
  nom: string
  description: string
  type: ControlType
  categorie: string
}

export interface FrameworkCategory {
  label: string
  icon: string
  color: string
  bg: string
}

export interface Framework {
  id: string
  nom: string
  version: string
  description: string
  icon: string
  categories: Record<string, FrameworkCategory>
  controles: FrameworkControl[]
}

// ─── Mapping id → label pour le sélecteur ────────────────────────────────────

export const FRAMEWORK_IDS = ['ISO27001', 'NIST_CSF', 'NIST_800_53', 'CIS_V8', 'ANSSI_HYG', 'HDS', 'PCI_DSS', 'DORA', 'IEC_62443', 'SOC2', 'NIST_SSDF', 'RGS', 'RECYF', 'TISAX', 'CUSTOM'] as const
export type FrameworkId = typeof FRAMEWORK_IDS[number]

// `domaine` (optionnel) classe le cadre dans une filière de contrôle/audit
// (cf. referentiel-domaines.ts). Absent ⇒ SECURITE_SI (tous les cadres cyber livrés).
// Les cadres non-cyber (phase 3 : LCB-FT, gel des avoirs, comptable…) le renseignent.
export const FRAMEWORK_META: Record<FrameworkId, { nom: string; version: string; icon: string; cible: string; domaine?: Domaine }> = {
  ISO27001:   { nom: 'ISO/IEC 27001',        version: '2022',     icon: '🌐', cible: 'Tout secteur — certification SMSI' },
  NIST_CSF:   { nom: 'NIST CSF',             version: '2.0',      icon: '🇺🇸', cible: 'Organisations US et internationales' },
  NIST_800_53:{ nom: 'NIST SP 800-53',       version: 'Rév. 5',   icon: '🔐', cible: 'Systèmes fédéraux US, secteur défense' },
  CIS_V8:     { nom: 'CIS Controls',         version: 'v8',       icon: '🛡️', cible: 'PME et ETI — priorisation pratique' },
  ANSSI_HYG:  { nom: 'ANSSI Guide d\'hygiène', version: 'v2',     icon: '🇫🇷', cible: 'Organisations françaises — ANSSI' },
  HDS:        { nom: 'HDS',                  version: '2024',     icon: '🏥', cible: 'Hébergeurs de données de santé (France)' },
  PCI_DSS:    { nom: 'PCI-DSS',              version: 'v4.0.1',   icon: '💳', cible: 'Organisations traitant des paiements' },
  DORA:       { nom: 'DORA',                 version: 'UE 2022/2554', icon: '🏦', cible: 'Banque, assurance, fintech, marchés financiers (UE)' },
  IEC_62443:  { nom: 'IEC 62443',            version: '+ ANSSI-PA-107', icon: '🏭', cible: 'Systèmes industriels OT/ICS (usine, énergie, transport, eau)' },
  SOC2:       { nom: 'SOC 2 Type II',         version: 'TSC 2017 (rév. 2022)', icon: '🧾', cible: 'Éditeurs SaaS / cloud — assurance clients B2B' },
  NIST_SSDF:  { nom: 'NIST SSDF',             version: 'SP 800-218', icon: '🧬', cible: 'Développement logiciel sécurisé / DevSecOps (CI/CD)' },
  RGS:        { nom: 'RGS',                  version: 'v2.0',     icon: '🏛️', cible: 'Téléservices publics / homologation SSI (France)' },
  RECYF:      { nom: 'ReCyF',                version: 'ANSSI 2026', icon: '🇫🇷', cible: 'Entités NIS2 (EEI/EE) — transposition opérationnelle française' },
  TISAX:      { nom: 'TISAX / VDA-ISA',      version: 'VDA-ISA v6', icon: '🚗', cible: 'Filière automobile — fournisseurs/équipementiers (exigence OEM)' },
  CUSTOM:     { nom: 'Référentiel custom',   version: '',         icon: '⚙️', cible: 'Contrôles définis par l\'analyste' },
}

// ─────────────────────────────────────────────────────────────────────────────
// ISO 27001:2022 — ré-exporté depuis ebios-data.ts (déjà défini)
// Les contrôles ISO 27001 sont dans ISO27001_ANNEXE_A de ebios-data.ts
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// NIST CSF 2.0
// Source : NIST Cybersecurity Framework 2.0 (Feb 2024)
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// CIS Controls v8
// Source : Center for Internet Security Controls v8 (2021)
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// ANSSI Guide d'hygiène informatique v2 — 42 mesures
// Source : ANSSI — Guide d'hygiène informatique (2017, mis à jour 2022)
// ─────────────────────────────────────────────────────────────────────────────

export const ANSSI_HYG_CATEGORIES: Record<string, FrameworkCategory> = {
  'SEN': { label: 'I — Sensibiliser et former', icon: '👥', color: 'text-blue-700', bg: 'bg-blue-50' },
  'CONN': { label: 'II — Connaître le système d\'information', icon: '🗺️', color: 'text-purple-700', bg: 'bg-purple-50' },
  'AUTH': { label: 'III — Authentifier et contrôler les accès', icon: '🔑', color: 'text-green-700', bg: 'bg-green-50' },
  'POSTE': { label: 'IV — Sécuriser les postes', icon: '💻', color: 'text-teal-700', bg: 'bg-teal-50' },
  'RESEAU': { label: 'V — Sécuriser le réseau', icon: '🌐', color: 'text-amber-700', bg: 'bg-amber-50' },
  'ADMIN': { label: 'VI — Sécuriser l\'administration', icon: '🛠️', color: 'text-red-700', bg: 'bg-red-50' },
  'NOMAD': { label: 'VII — Gérer le nomadisme', icon: '📱', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  'MAJ': { label: 'VIII — Maintenir à jour le SI', icon: '🔄', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  'SUPERV': { label: 'IX — Superviser, auditer, réagir', icon: '📊', color: 'text-orange-700', bg: 'bg-orange-50' },
  'PLUS': { label: 'X — Pour aller plus loin', icon: '🎯', color: 'text-gray-700', bg: 'bg-gray-50' },
}

// ── ANSSI — Guide d’hygiène informatique : les 42 mesures (v2, 2017) ──────────
// Intitulés OFFICIELS exacts (source : guide ANSSI). Ne pas paraphraser les nom.
export const ANSSI_HYG_CONTROLES: FrameworkControl[] = [
  { ref:'R1', type:'HUMAINE', categorie:'SEN', nom:'Former les équipes opérationnelles à la sécurité des systèmes d\'information', description:'Former les équipes opérationnelles (administrateurs, développeurs, chefs de projet, RSSI) à la sécurité des SI.' },
  { ref:'R2', type:'HUMAINE', categorie:'SEN', nom:'Sensibiliser les utilisateurs aux bonnes pratiques élémentaires de sécurité informatique', description:'Sensibiliser l\'ensemble des utilisateurs aux bonnes pratiques élémentaires (charte, campagnes).' },
  { ref:'R3', type:'ORGANISATIONNELLE', categorie:'SEN', nom:'Maîtriser les risques de l\'infogérance', description:'Évaluer et encadrer contractuellement les risques liés à l\'externalisation (infogérance).' },
  { ref:'R4', type:'ORGANISATIONNELLE', categorie:'CONN', nom:'Identifier les informations et serveurs les plus sensibles et maintenir un schéma du réseau', description:'Identifier les informations et serveurs les plus sensibles et tenir à jour un schéma du réseau.' },
  { ref:'R5', type:'ORGANISATIONNELLE', categorie:'CONN', nom:'Disposer d\'un inventaire exhaustif des comptes privilégiés et le maintenir à jour', description:'Établir et maintenir un inventaire exhaustif des comptes à privilèges.' },
  { ref:'R6', type:'ORGANISATIONNELLE', categorie:'CONN', nom:'Organiser les procédures d\'arrivée, de départ et de changement de fonction des utilisateurs', description:'Formaliser les procédures d\'arrivée, de départ et de changement de fonction (droits, accès, matériel).' },
  { ref:'R7', type:'TECHNOLOGIQUE', categorie:'CONN', nom:'Autoriser la connexion au réseau de l\'entité aux seuls équipements maîtrisés', description:'N\'autoriser sur le réseau que les équipements maîtrisés par l\'entité.' },
  { ref:'R8', type:'TECHNOLOGIQUE', categorie:'AUTH', nom:'Identifier nommément chaque personne accédant au système et distinguer les rôles utilisateur/administrateur', description:'Attribuer un compte nominatif à chaque personne et séparer les rôles utilisateur et administrateur.' },
  { ref:'R9', type:'ORGANISATIONNELLE', categorie:'AUTH', nom:'Attribuer les bons droits sur les ressources sensibles du système d\'information', description:'Attribuer les droits sur les ressources sensibles selon le besoin d\'en connaître (moindre privilège).' },
  { ref:'R10', type:'TECHNOLOGIQUE', categorie:'AUTH', nom:'Définir et vérifier des règles de choix et de dimensionnement des mots de passe', description:'Définir une politique de mots de passe (longueur, complexité) et en vérifier l\'application.' },
  { ref:'R11', type:'TECHNOLOGIQUE', categorie:'AUTH', nom:'Protéger les mots de passe stockés sur les systèmes', description:'Stocker les mots de passe de manière sécurisée (empreintes salées), jamais en clair.' },
  { ref:'R12', type:'TECHNOLOGIQUE', categorie:'AUTH', nom:'Changer les éléments d\'authentification par défaut sur les équipements et services', description:'Modifier systématiquement les identifiants et mots de passe par défaut.' },
  { ref:'R13', type:'TECHNOLOGIQUE', categorie:'AUTH', nom:'Privilégier lorsque c\'est possible une authentification forte', description:'Déployer l\'authentification forte (multi-facteurs) notamment pour les accès sensibles et distants.' },
  { ref:'R14', type:'TECHNOLOGIQUE', categorie:'POSTE', nom:'Mettre en place un niveau de sécurité minimal sur l\'ensemble du parc informatique', description:'Appliquer un socle de configuration de sécurité minimal sur tout le parc.' },
  { ref:'R15', type:'TECHNOLOGIQUE', categorie:'POSTE', nom:'Se protéger des menaces relatives à l\'utilisation de supports amovibles', description:'Encadrer et contrôler l\'usage des supports amovibles (interdiction, chiffrement, analyse).' },
  { ref:'R16', type:'TECHNOLOGIQUE', categorie:'POSTE', nom:'Utiliser un outil de gestion centralisée afin d\'homogénéiser les politiques de sécurité', description:'Homogénéiser les politiques de sécurité via un outil de gestion centralisée.' },
  { ref:'R17', type:'TECHNOLOGIQUE', categorie:'POSTE', nom:'Activer et configurer le pare-feu local des postes de travail', description:'Activer et configurer le pare-feu local sur les postes de travail.' },
  { ref:'R18', type:'TECHNOLOGIQUE', categorie:'POSTE', nom:'Chiffrer les données sensibles transmises par voie Internet', description:'Chiffrer les données sensibles lors de leur transmission sur Internet.' },
  { ref:'R19', type:'TECHNOLOGIQUE', categorie:'RESEAU', nom:'Segmenter le réseau et mettre en place un cloisonnement entre ces zones', description:'Segmenter le réseau et cloisonner les zones selon leur sensibilité.' },
  { ref:'R20', type:'TECHNOLOGIQUE', categorie:'RESEAU', nom:'S\'assurer de la sécurité des réseaux d\'accès Wi-Fi et de la séparation des usages', description:'Sécuriser les réseaux Wi-Fi et séparer les usages (professionnel, invité).' },
  { ref:'R21', type:'TECHNOLOGIQUE', categorie:'RESEAU', nom:'Utiliser des protocoles sécurisés dès qu\'ils existent', description:'Privilégier les protocoles sécurisés (TLS, SSH…) dès qu\'ils existent.' },
  { ref:'R22', type:'TECHNOLOGIQUE', categorie:'RESEAU', nom:'Mettre en place une passerelle d\'accès sécurisé à Internet', description:'Filtrer et sécuriser les accès à Internet via une passerelle dédiée.' },
  { ref:'R23', type:'TECHNOLOGIQUE', categorie:'RESEAU', nom:'Cloisonner les services visibles depuis Internet du reste du système d\'information', description:'Isoler les services exposés sur Internet (DMZ) du reste du SI.' },
  { ref:'R24', type:'TECHNOLOGIQUE', categorie:'RESEAU', nom:'Protéger sa messagerie professionnelle', description:'Protéger la messagerie (anti-spam, anti-maliciel, SPF/DKIM/DMARC, chiffrement).' },
  { ref:'R25', type:'TECHNOLOGIQUE', categorie:'RESEAU', nom:'Sécuriser les interconnexions réseau dédiées avec les partenaires', description:'Sécuriser les interconnexions réseau dédiées avec les partenaires.' },
  { ref:'R26', type:'PHYSIQUE', categorie:'RESEAU', nom:'Contrôler et protéger l\'accès aux salles serveurs et aux locaux techniques', description:'Contrôler physiquement l\'accès aux salles serveurs et locaux techniques.' },
  { ref:'R27', type:'TECHNOLOGIQUE', categorie:'ADMIN', nom:'Interdire l\'accès à Internet depuis les postes ou serveurs utilisés pour l\'administration du système d\'information', description:'Interdire l\'accès Internet depuis les postes et serveurs d\'administration.' },
  { ref:'R28', type:'TECHNOLOGIQUE', categorie:'ADMIN', nom:'Utiliser un réseau dédié et cloisonné pour l\'administration du système d\'information', description:'Administrer le SI via un réseau dédié et cloisonné.' },
  { ref:'R29', type:'ORGANISATIONNELLE', categorie:'ADMIN', nom:'Limiter au strict besoin opérationnel les droits d\'administration sur les postes de travail', description:'Restreindre les droits d\'administration locale au strict besoin opérationnel.' },
  { ref:'R30', type:'PHYSIQUE', categorie:'NOMAD', nom:'Prendre des mesures de sécurisation physique des terminaux nomades', description:'Protéger physiquement les terminaux nomades (câble antivol, discrétion, filtre écran).' },
  { ref:'R31', type:'TECHNOLOGIQUE', categorie:'NOMAD', nom:'Chiffrer les données sensibles, en particulier sur le matériel potentiellement perdable', description:'Chiffrer les données sensibles, en particulier sur les matériels susceptibles d\'être perdus ou volés.' },
  { ref:'R32', type:'TECHNOLOGIQUE', categorie:'NOMAD', nom:'Sécuriser la connexion réseau des postes utilisés en situation de nomadisme', description:'Sécuriser les connexions réseau nomades (VPN, authentification forte).' },
  { ref:'R33', type:'ORGANISATIONNELLE', categorie:'NOMAD', nom:'Adopter des politiques de sécurité dédiées aux terminaux mobiles', description:'Définir des politiques de sécurité dédiées aux terminaux mobiles (MDM).' },
  { ref:'R34', type:'ORGANISATIONNELLE', categorie:'MAJ', nom:'Définir une politique de mise à jour des composants du système d\'information', description:'Définir et appliquer une politique de mise à jour (correctifs) des composants du SI.' },
  { ref:'R35', type:'ORGANISATIONNELLE', categorie:'MAJ', nom:'Anticiper la fin de la maintenance des logiciels et systèmes et limiter les adhérences logicielles', description:'Anticiper l\'obsolescence (fin de support) et limiter les adhérences logicielles.' },
  { ref:'R36', type:'TECHNOLOGIQUE', categorie:'SUPERV', nom:'Activer et configurer les journaux des composants les plus importants', description:'Activer et configurer la journalisation des composants les plus importants.' },
  { ref:'R37', type:'ORGANISATIONNELLE', categorie:'SUPERV', nom:'Définir et appliquer une politique de sauvegarde des composants critiques', description:'Définir et appliquer une politique de sauvegarde des composants critiques (et tester la restauration).' },
  { ref:'R38', type:'ORGANISATIONNELLE', categorie:'SUPERV', nom:'Procéder à des contrôles et audits de sécurité réguliers puis appliquer les actions correctives associées', description:'Réaliser des contrôles et audits de sécurité réguliers et traiter les écarts.' },
  { ref:'R39', type:'ORGANISATIONNELLE', categorie:'SUPERV', nom:'Désigner un référent en sécurité des systèmes d\'information et le faire connaître auprès du personnel', description:'Désigner un référent SSI et le faire connaître au personnel.' },
  { ref:'R40', type:'ORGANISATIONNELLE', categorie:'SUPERV', nom:'Définir une procédure de gestion des incidents de sécurité', description:'Définir une procédure de gestion des incidents de sécurité.' },
  { ref:'R41', type:'ORGANISATIONNELLE', categorie:'PLUS', nom:'Mener une analyse de risques formelle', description:'Conduire une analyse de risques formelle (ex. EBIOS Risk Manager).' },
  { ref:'R42', type:'ORGANISATIONNELLE', categorie:'PLUS', nom:'Privilégier l\'usage de produits et de services qualifiés par l\'ANSSI', description:'Privilégier les produits et prestataires qualifiés par l\'ANSSI.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// HDS — Hébergement de Données de Santé (France)
// Source : ANS — Référentiel de certification HDS v2 (2023)
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// PCI-DSS v4.0
// Source : PCI Security Standards Council — PCI Data Security Standard v4.0 (2022)
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// NIST SP 800-53 Rev 5 — Contrôles clés par famille
// Source : NIST Special Publication 800-53 Rev 5 (2020)
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// Catalogue central — map par framework ID
// ─────────────────────────────────────────────────────────────────────────────


export function getFrameworkControles(frameworkId: string, customControles?: any[], locale?: Locale): FrameworkControl[] {
  // Référentiels dont les contrôles sont externalisés en i18n (ebios-data) :
  // localisés si une locale est fournie (issue #66), sinon FR (source).
  if (locale) {
    const d = getEbiosData(locale) as any
    switch (frameworkId) {
      case 'ISO27001':  return d.ISO27001_ANNEXE_A
      case 'DORA':      return d.DORA_CONTROLES
      case 'IEC_62443': return d.IEC_62443_CONTROLES
      case 'SOC2':      return d.SOC2_CONTROLES
      case 'NIST_SSDF': return d.NIST_SSDF_CONTROLES
      case 'RGS':       return d.RGS_CONTROLES
      case 'RECYF':     return d.RECYF_CONTROLES
      case 'TISAX':     return d.TISAX_CONTROLES
      case 'NIST_CSF':    return d.NIST_CSF_CONTROLES
      case 'NIST_800_53': return d.NIST_800_53_CONTROLES
      case 'CIS_V8':      return d.CIS_V8_CONTROLES
      case 'HDS':         return d.HDS_CONTROLES
      case 'PCI_DSS':     return d.PCI_DSS_CONTROLES
    }
  }
  switch (frameworkId) {
    case 'ISO27001': {
      // Importé dynamiquement depuis ebios-data pour éviter la duplication
      const { ISO27001_ANNEXE_A } = require('@/lib/ebios-data')
      return ISO27001_ANNEXE_A
    }
    case 'NIST_CSF':    return NIST_CSF_CONTROLES
    case 'NIST_800_53': return NIST_800_53_CONTROLES
    case 'CIS_V8':      return CIS_V8_CONTROLES
    case 'ANSSI_HYG':   return ANSSI_HYG_CONTROLES
    case 'HDS':         return HDS_CONTROLES
    case 'PCI_DSS':     return PCI_DSS_CONTROLES
    case 'DORA':        return DORA_CONTROLES
    case 'IEC_62443':   return IEC_62443_CONTROLES
    case 'SOC2':        return SOC2_CONTROLES
    case 'NIST_SSDF':   return NIST_SSDF_CONTROLES
    case 'RGS':         return RGS_CONTROLES
    case 'RECYF':       return RECYF_CONTROLES
    case 'TISAX':       return TISAX_CONTROLES
    case 'CUSTOM':      return Array.isArray(customControles) ? customControles : []
    default:            return []
  }
}

export function getFrameworkCategories(frameworkId: string, locale?: Locale): Record<string, FrameworkCategory> {
  if (locale) {
    const d = getEbiosData(locale) as any
    switch (frameworkId) {
      case 'ISO27001':  return d.ISO27001_CATEGORIES
      case 'DORA':      return d.DORA_CATEGORIES
      case 'IEC_62443': return d.IEC_62443_CATEGORIES
      case 'SOC2':      return d.SOC2_CATEGORIES
      case 'NIST_SSDF': return d.NIST_SSDF_CATEGORIES
      case 'RGS':       return d.RGS_CATEGORIES
      case 'RECYF':     return d.RECYF_CATEGORIES
      case 'TISAX':     return d.TISAX_CATEGORIES
      case 'NIST_CSF':    return d.NIST_CSF_CATEGORIES
      case 'NIST_800_53': return d.NIST_800_53_CATEGORIES
      case 'CIS_V8':      return d.CIS_V8_CATEGORIES
      case 'HDS':         return d.HDS_CATEGORIES
      case 'PCI_DSS':     return d.PCI_DSS_CATEGORIES
    }
  }
  switch (frameworkId) {
    case 'ISO27001': {
      const { ISO27001_CATEGORIES } = require('@/lib/ebios-data')
      return ISO27001_CATEGORIES
    }
    case 'NIST_CSF':    return NIST_CSF_CATEGORIES
    case 'NIST_800_53': return NIST_800_53_CATEGORIES
    case 'CIS_V8':      return CIS_V8_CATEGORIES
    case 'ANSSI_HYG':   return ANSSI_HYG_CATEGORIES
    case 'HDS':         return HDS_CATEGORIES
    case 'PCI_DSS':     return PCI_DSS_CATEGORIES
    case 'DORA':        return DORA_CATEGORIES
    case 'IEC_62443':   return IEC_62443_CATEGORIES
    case 'SOC2':        return SOC2_CATEGORIES
    case 'NIST_SSDF':   return NIST_SSDF_CATEGORIES
    case 'RGS':         return RGS_CATEGORIES
    case 'RECYF':       return RECYF_CATEGORIES
    case 'TISAX':       return TISAX_CATEGORIES
    case 'CUSTOM':      return { CUSTOM: { label: 'Contrôles personnalisés', icon: '⚙️', color: 'text-gray-700', bg: 'bg-gray-50' } }
    default:            return {}
  }
}

/**
 * Profil de dimensionnement de l'analyse (taille / maturité de l'organisation).
 * Oriente les référentiels recommandés vers un socle atteignable. `STANDARD` =
 * comportement neutre (par défaut). Stocké en JSON dans Cadrage (pas de migration).
 */
export const TAILLES_ANALYSE = ['STANDARD', 'TPE', 'PME', 'ETI_GE'] as const
export type TailleAnalyse = typeof TAILLES_ANALYSE[number]

/** Réordonne les référentiels selon la taille (socle léger en tête pour TPE/PME). */
export function adaptFrameworksForSize(base: FrameworkId[], taille?: TailleAnalyse | null): FrameworkId[] {
  const dedup = (a: FrameworkId[]) => a.filter((x, i) => a.indexOf(x) === i)
  if (taille === 'TPE') return dedup(['ANSSI_HYG', 'CIS_V8', ...base])
  if (taille === 'PME') return dedup(['ANSSI_HYG', ...base])
  return base // STANDARD (défaut) et ETI_GE : recommandations sectorielles inchangées
}

/** Logique sectorielle de base (sans adaptation de taille). */
function baseFrameworksForSector(secteur?: string | null): FrameworkId[] {
  const s = (secteur ?? '').toLowerCase()
  const has = (...kw: string[]) => kw.some(k => s.includes(k))
  if (has('banque', 'finance', 'bancaire', 'assur', 'fintech', 'financ')) return ['DORA', 'PCI_DSS', 'ISO27001']
  if (has('santé', 'sante', 'médico', 'medico', 'hospital', 'soin', 'health')) return ['HDS', 'ISO27001']
  if (has('défense', 'defense', 'national', 'militaire', 'defence')) return ['NIST_800_53', 'ANSSI_HYG']
  if (has('administration', 'public', 'collectivit', 'état', 'etat', 'government')) return ['ANSSI_HYG', 'RGS', 'ISO27001']
  if (has('énergie', 'energie', 'utilities', 'eau', 'nucléaire', 'nucleaire', 'energy')) return ['IEC_62443', 'ANSSI_HYG', 'ISO27001']
  if (has('télécom', 'telecom', 'communication')) return ['ANSSI_HYG', 'NIST_CSF', 'ISO27001']
  if (has('transport', 'logistique', 'aérien', 'aerien', 'ferroviaire', 'logistics')) return ['IEC_62443', 'ANSSI_HYG', 'ISO27001']
  if (has('e-commerce', 'ecommerce', 'marketplace')) return ['PCI_DSS', 'ISO27001', 'SOC2', 'NIST_SSDF']
  if (has('commerce', 'distribution', 'retail', 'paiement', 'payment')) return ['PCI_DSS', 'ISO27001']
  if (has('industrie', 'manufactur', 'usine', 'scada', 'industry')) return ['IEC_62443', 'CIS_V8', 'ISO27001']
  if (has('informatique', 'numérique', 'numerique', 'logiciel', 'saas', 'cloud', 'tech', 'digital')) return ['ISO27001', 'SOC2', 'NIST_SSDF', 'NIST_CSF', 'CIS_V8']
  if (has('éducation', 'education', 'recherche', 'université', 'universite', 'research')) return ['ISO27001', 'ANSSI_HYG']
  if (has('juridique', 'avocat', 'notaire', 'juriste', 'barreau', 'legal', 'law firm')) return ['ANSSI_HYG', 'ISO27001']
  if (has('agricol', 'agro', 'agriculture', 'élevage', 'elevage', 'farming', 'agri-food')) return ['IEC_62443', 'ANSSI_HYG', 'ISO27001']
  if (has('immobilier', 'construction', 'bâtiment', 'batiment', 'btp', 'real estate')) return ['ANSSI_HYG', 'ISO27001']
  if (has('média', 'media', 'presse', 'culture', 'audiovisuel', 'édition', 'edition')) return ['ANSSI_HYG', 'ISO27001']
  if (has('tourisme', 'hôtel', 'hotel', 'hôtellerie', 'hotellerie', 'restauration', 'tourism', 'hospitality')) return ['PCI_DSS', 'ISO27001']
  if (has('association', 'économie sociale', 'economie sociale', 'non-profit', 'nonprofit')) return ['ANSSI_HYG', 'ISO27001']
  return ['ISO27001']
}

/**
 * Affine la liste de référentiels selon le sous-secteur (issue #25) : fait
 * remonter en priorité les référentiels les plus pertinents pour le sous-type
 * (dév. sécurisé pour un éditeur, PCI-DSS pour le paiement, IEC 62443 pour l'OT).
 * Matching par mots-clés sur l'id stable du sous-secteur. Sans effet si aucun
 * sous-secteur ou s'il est neutre. Dédoublonne en conservant l'ordre.
 */
export function refineFrameworksBySousSecteur(base: FrameworkId[], sousSecteur?: string | null): FrameworkId[] {
  const s = (sousSecteur ?? '').toLowerCase()
  if (!s) return base
  let priority: FrameworkId[] = []
  if (/(editeur|logiciel|sih|saas|software)/.test(s)) priority = ['NIST_SSDF', 'SOC2']
  else if (/(fintech|paiement|payment|monetique)/.test(s)) priority = ['PCI_DSS']
  // OT / industriel, y compris toute la filière énergie (production, réseau,
  // nucléaire, fossile, renouvelable : éolien/PV/BESS pilotés par SCADA) — issue #94
  else if (/(process|scada|nucleaire|nuclear|\bot\b|energie-|renouvelable|eolien|photovolt|solaire)/.test(s)) priority = ['IEC_62443']
  // Défense (issue #79) : BITD (industrie d'armement) → certification DGA (ISO 27001)
  // + SI embarqués / systèmes d'armes (IEC 62443). Les forces armées conservent le
  // socle sectoriel (NIST 800-53 prioritaire + ANSSI Hygiène), donc pas de priorité ici.
  else if (/bitd/.test(s)) priority = ['ISO27001', 'IEC_62443']
  // Filière automobile (issue #110) : les équipementiers/sous-traitants sont tenus
  // par les constructeurs (OEM) d'être évalués TISAX (label ENX basé sur VDA-ISA).
  // On conserve IEC 62443 en base pour l'OT de la ligne d'assemblage.
  else if (/auto/.test(s)) priority = ['TISAX']
  if (priority.length === 0) return base
  return [...new Set([...priority, ...base])]
}

/** Statut réglementaire de l'entité (cf. lib/qualification.ts). */
export type StatutReglementaire = 'aucun' | 'OSE' | 'EEI' | 'OIV'

/**
 * Conditionne DORA au profil réglementaire (issues #67, #106). DORA s'applique aux
 * entités financières RÉGLEMENTÉES quelle que soit leur taille (proportionnalité
 * art. 16 = régime allégé, PAS exclusion). On ne retire DORA que pour une TPE/PME
 * finance NON agréée et SANS statut EEI/OIV (ex. fintech pré-agrément) au profit
 * d'un socle atteignable (CIS_V8 + ISO27001 + PCI-DSS). Une entité financière
 * agréée (ACPR/AMF) conserve DORA même petite.
 */
export function refineFrameworksByRegulatory(fw: FrameworkId[], taille?: TailleAnalyse | null, statut?: StatutReglementaire | null, agreeeFinance?: boolean | null): FrameworkId[] {
  if (!fw.includes('DORA')) return fw
  const petite = taille === 'TPE' || taille === 'PME'
  const reglementee = statut === 'EEI' || statut === 'OIV' || agreeeFinance === true
  if (!petite || reglementee) return fw
  const out = fw.filter(f => f !== 'DORA')
  if (!out.includes('CIS_V8')) out.unshift('CIS_V8')
  return out
}

/**
 * Référentiels recommandés selon le secteur, la taille de l'organisation, le
 * sous-secteur ET le statut réglementaire (le 1er = prioritaire). CUSTOM exclu.
 * Guide le choix sans l'imposer.
 */
export function recommendedFrameworksForSector(secteur?: string | null, taille?: TailleAnalyse | null, sousSecteur?: string | null, statut?: StatutReglementaire | null, agreeeFinance?: boolean | null): FrameworkId[] {
  let fw = refineFrameworksBySousSecteur(baseFrameworksForSector(secteur), sousSecteur)
  fw = refineFrameworksByRegulatory(fw, taille, statut, agreeeFinance)
  fw = refineFrameworksForNis2(fw, statut)
  return adaptFrameworksForSize(fw, taille)
}

/**
 * Entités NIS2 (essentielles importantes EEI ou opérateurs de services essentiels
 * OSE) — France : promeut ReCyF en tête (issue #90). ReCyF est la transposition
 * opérationnelle française des exigences de l'art. 21 NIS2, elle guide donc en
 * priorité les entités sous statut réglementaire NIS2, sans exclure les autres.
 */
export function refineFrameworksForNis2(fw: FrameworkId[], statut?: StatutReglementaire | null): FrameworkId[] {
  if (statut !== 'EEI' && statut !== 'OSE') return fw
  const out: FrameworkId[] = fw.filter(f => f !== 'RECYF')
  out.unshift('RECYF')
  return out
}
