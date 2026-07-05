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
 *  • CUSTOM                        (contrôles définis par l'analyste)
 */
import type { Locale } from '@/lib/i18n'
import { getEbiosData } from '@/lib/ebios-data-i18n'
import {
  DORA_CONTROLES, DORA_CATEGORIES,
  IEC_62443_CONTROLES, IEC_62443_CATEGORIES,
  SOC2_CONTROLES, SOC2_CATEGORIES,
  NIST_SSDF_CONTROLES, NIST_SSDF_CATEGORIES,
  RGS_CONTROLES, RGS_CATEGORIES,
  RECYF_CONTROLES, RECYF_CATEGORIES,
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

export const FRAMEWORK_IDS = ['ISO27001', 'NIST_CSF', 'NIST_800_53', 'CIS_V8', 'ANSSI_HYG', 'HDS', 'PCI_DSS', 'DORA', 'IEC_62443', 'SOC2', 'NIST_SSDF', 'RGS', 'RECYF', 'CUSTOM'] as const
export type FrameworkId = typeof FRAMEWORK_IDS[number]

export const FRAMEWORK_META: Record<FrameworkId, { nom: string; version: string; icon: string; cible: string }> = {
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
  'SEN':  { label: 'Sensibilisation et formation',             icon: '👥', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  'CONN': { label: 'Connaissance du SI',                       icon: '🗺️', color: 'text-purple-700', bg: 'bg-purple-50' },
  'AUTH': { label: 'Authentification et maîtrise des accès',   icon: '🔑', color: 'text-green-700',  bg: 'bg-green-50'  },
  'SEC':  { label: 'Sécurité des postes et équipements',       icon: '💻', color: 'text-teal-700',   bg: 'bg-teal-50'   },
  'RESEAU': { label: 'Sécurité des réseaux',                  icon: '🌐', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  'APPLI': { label: 'Sécurité des applications et données',    icon: '🔒', color: 'text-orange-700', bg: 'bg-orange-50' },
}

export const ANSSI_HYG_CONTROLES: FrameworkControl[] = [
  // Sensibilisation et formation
  { ref:'R1',  type:'HUMAINE',          categorie:'SEN',   nom:'Sensibiliser et former les équipes à la sécurité numérique', description:'Former et sensibiliser tous les personnels (DSI, utilisateurs, décideurs) aux bonnes pratiques et aux risques cybersécurité.' },
  { ref:'R2',  type:'ORGANISATIONNELLE', categorie:'SEN',  nom:'Porter la problématique de sécurité au niveau de la direction', description:'Désigner un responsable de la sécurité des systèmes d\'information (RSSI) et lui donner les moyens nécessaires.' },
  // Connaissance du SI
  { ref:'R3',  type:'TECHNOLOGIQUE',    categorie:'CONN',  nom:'Réaliser et maintenir un schéma du réseau',                  description:'Maintenir un schéma à jour du réseau avec les interconnexions et équipements. Base de toute démarche SSI.' },
  { ref:'R4',  type:'TECHNOLOGIQUE',    categorie:'CONN',  nom:'Identifier les informations et les serveurs les plus sensibles', description:'Identifier les données les plus sensibles et les serveurs qui les hébergent pour les protéger en priorité.' },
  { ref:'R5',  type:'ORGANISATIONNELLE', categorie:'CONN', nom:'Gérer les prestataires de services et les sous-traitants',   description:'Intégrer les prestataires dans la politique SSI (contrats, questionnaires, audits, habilitations).' },
  { ref:'R6',  type:'ORGANISATIONNELLE', categorie:'CONN', nom:'Rédiger et faire appliquer une politique de sécurité des SI (PSSI)', description:'Rédiger une PSSI adaptée à l\'organisation, la faire approuver par la direction et la faire appliquer.' },
  // Authentification et maîtrise des accès
  { ref:'R7',  type:'TECHNOLOGIQUE',    categorie:'AUTH',  nom:'Choisir des mots de passe robustes',                         description:'Imposer une politique de mots de passe robustes : longueur ≥ 12 caractères, complexité, pas de réutilisation.' },
  { ref:'R8',  type:'TECHNOLOGIQUE',    categorie:'AUTH',  nom:'Protéger les mots de passe des systèmes et des utilisateurs', description:'Stocker les mots de passe sous forme hachée (bcrypt, Argon2). Ne jamais les stocker en clair.' },
  { ref:'R9',  type:'ORGANISATIONNELLE', categorie:'AUTH', nom:'Définir des procédures de création et de révocation des comptes', description:'Formaliser les procédures d\'ouverture et de fermeture des comptes (arrivées, départs, mutations).' },
  { ref:'R10', type:'TECHNOLOGIQUE',    categorie:'AUTH',  nom:'Supprimer les comptes obsolètes',                            description:'Désactiver ou supprimer les comptes des personnes ayant quitté l\'organisation dans les 24h.' },
  { ref:'R11', type:'ORGANISATIONNELLE', categorie:'AUTH', nom:'Réduire les droits au strict nécessaire (moindre privilège)', description:'Appliquer le principe du moindre privilège : chaque compte n\'a que les droits nécessaires à sa mission.' },
  { ref:'R12', type:'TECHNOLOGIQUE',    categorie:'AUTH',  nom:'Limiter le nombre d\'administrateurs',                       description:'Réduire le nombre de comptes administrateurs au minimum. Ne pas utiliser les comptes admin pour les tâches courantes.' },
  { ref:'R13', type:'TECHNOLOGIQUE',    categorie:'AUTH',  nom:'Utiliser des comptes nominatifs',                            description:'Tout accès doit être associé à un compte nominatif. Interdire les comptes génériques partagés.' },
  { ref:'R14', type:'TECHNOLOGIQUE',    categorie:'AUTH',  nom:'Mettre en place l\'authentification forte',                  description:'Déployer l\'authentification multi-facteurs (MFA) pour tous les accès distants et critiques.' },
  { ref:'R15', type:'TECHNOLOGIQUE',    categorie:'AUTH',  nom:'Sécuriser les accès distants (VPN)',                         description:'Chiffrer les accès distants via VPN avec une authentification forte. Désactiver les accès distants inutilisés.' },
  // Sécurité des postes et équipements
  { ref:'R16', type:'TECHNOLOGIQUE',    categorie:'SEC',   nom:'Maintenir les logiciels à jour (correctifs)',                 description:'Appliquer les mises à jour de sécurité dans les plus brefs délais (72h pour les vulnérabilités critiques).' },
  { ref:'R17', type:'TECHNOLOGIQUE',    categorie:'SEC',   nom:'Utiliser un antivirus et un pare-feu local',                 description:'Déployer un antivirus à jour et un pare-feu local sur tous les postes et serveurs.' },
  { ref:'R18', type:'TECHNOLOGIQUE',    categorie:'SEC',   nom:'Chiffrer les données sensibles sur les postes mobiles',      description:'Activer le chiffrement complet des disques (BitLocker, FileVault, LUKS) sur tous les terminaux mobiles.' },
  { ref:'R19', type:'TECHNOLOGIQUE',    categorie:'SEC',   nom:'Protéger les appareils mobiles (MDM)',                       description:'Gérer les mobiles et tablettes via un MDM, imposer le verrouillage automatique et le chiffrement.' },
  { ref:'R20', type:'TECHNOLOGIQUE',    categorie:'SEC',   nom:'Sauvegarder régulièrement les données',                      description:'Sauvegarder toutes les données critiques selon la règle 3-2-1. Tester les restaurations régulièrement.' },
  { ref:'R21', type:'TECHNOLOGIQUE',    categorie:'SEC',   nom:'Éviter les supports USB non maîtrisés',                      description:'Interdire ou contrôler l\'usage des clés USB. Scanner tout support externe avant utilisation.' },
  { ref:'R22', type:'TECHNOLOGIQUE',    categorie:'SEC',   nom:'Désactiver les services et fonctionnalités non utilisés',    description:'Supprimer ou désactiver les services, protocoles et composants logiciels non nécessaires (surface d\'attaque).' },
  { ref:'R23', type:'TECHNOLOGIQUE',    categorie:'SEC',   nom:'Sécuriser les terminaux de paiement (TPE)',                  description:'Isoler les terminaux de paiement sur un réseau dédié et s\'assurer de leur conformité PCI-DSS.' },
  // Sécurité des réseaux
  { ref:'R24', type:'TECHNOLOGIQUE',    categorie:'RESEAU', nom:'Cloisonner le réseau (zones de sécurité)',                  description:'Segmenter le réseau en zones de sécurité (Internet, DMZ, LAN, zones sensibles) avec des contrôles de flux.' },
  { ref:'R25', type:'TECHNOLOGIQUE',    categorie:'RESEAU', nom:'Sécuriser les accès Wi-Fi',                                 description:'Utiliser WPA3 ou WPA2-Enterprise. Ne jamais utiliser WEP/WPA. Séparer le Wi-Fi invité du réseau interne.' },
  { ref:'R26', type:'TECHNOLOGIQUE',    categorie:'RESEAU', nom:'Sécuriser les flux réseau entre les zones sensibles',       description:'Contrôler et chiffrer les flux entre les zones de sécurité. Journaliser les connexions entre zones critiques.' },
  { ref:'R27', type:'TECHNOLOGIQUE',    categorie:'RESEAU', nom:'Protéger contre les attaques DDoS',                         description:'Mettre en place des protections DDoS (rate limiting, scrubbing, CDN) pour les services exposés.' },
  { ref:'R28', type:'TECHNOLOGIQUE',    categorie:'RESEAU', nom:'Surveiller le trafic réseau',                               description:'Mettre en place une supervision du trafic réseau pour détecter les anomalies et intrusions.' },
  { ref:'R29', type:'TECHNOLOGIQUE',    categorie:'RESEAU', nom:'Utiliser des protocoles réseau sécurisés',                  description:'Désactiver les protocoles non sécurisés (Telnet, FTP, HTTP, SNMPv1/v2). Utiliser SSH, SFTP, HTTPS, SNMPv3.' },
  // Sécurité des applications et données
  { ref:'R30', type:'TECHNOLOGIQUE',    categorie:'APPLI',  nom:'Sécuriser les sites web exposés sur Internet',              description:'Déployer un WAF, appliquer l\'OWASP Top 10, activer HTTPS strict, analyser le code source. Pen-test régulier.' },
  { ref:'R31', type:'TECHNOLOGIQUE',    categorie:'APPLI',  nom:'Contrôler les applications utilisées',                     description:'N\'autoriser que des applications validées par la DSI. Prohiber les applications Shadow IT non contrôlées.' },
  { ref:'R32', type:'ORGANISATIONNELLE', categorie:'APPLI', nom:'Surveiller et contrôler les accès à Internet',             description:'Contrôler et filtrer les accès à Internet via un proxy et un filtrage de contenu. Bloquer les sites malveillants.' },
  { ref:'R33', type:'ORGANISATIONNELLE', categorie:'APPLI', nom:'Protéger les données personnelles (RGPD)',                  description:'Mettre en œuvre les mesures techniques et organisationnelles RGPD (registre, PIA, pseudonymisation, DPO).' },
  { ref:'R34', type:'TECHNOLOGIQUE',    categorie:'APPLI',  nom:'Sécuriser les messageries électroniques',                  description:'Déployer une solution anti-spam/anti-phishing. Activer SPF, DKIM, DMARC sur le domaine de messagerie.' },
  { ref:'R35', type:'ORGANISATIONNELLE', categorie:'APPLI', nom:'Maîtriser les risques liés à l\'externalisation et au Cloud', description:'Qualifier les prestataires Cloud, vérifier la localisation des données, définir les engagements (SLA, reversibilité).' },
  { ref:'R36', type:'ORGANISATIONNELLE', categorie:'APPLI', nom:'Mettre en place un plan de continuité d\'activité (PCA)',  description:'Définir et tester régulièrement un PCA couvrant les scénarios de défaillance et de cyberattaque.' },
  { ref:'R37', type:'ORGANISATIONNELLE', categorie:'APPLI', nom:'Organiser la réponse aux incidents (PRI)',                 description:'Définir et documenter les procédures de gestion des incidents (détection, confinement, notification ANSSI).' },
  { ref:'R38', type:'TECHNOLOGIQUE',    categorie:'APPLI',  nom:'Gérer et superviser les journaux de sécurité',             description:'Activer et centraliser les journaux d\'audit. Définir des alertes pour les événements critiques.' },
  { ref:'R39', type:'ORGANISATIONNELLE', categorie:'APPLI', nom:'Réaliser des audits de sécurité réguliers',               description:'Conduire des audits techniques (PASSI qualifié) et organisationnels de sécurité régulièrement.' },
  { ref:'R40', type:'ORGANISATIONNELLE', categorie:'APPLI', nom:'Veiller sur les vulnérabilités et menaces',               description:'S\'abonner aux bulletins CERT-FR, ANSSI. Suivre les CVE et traiter les vulnérabilités dans les délais.' },
  { ref:'R41', type:'TECHNOLOGIQUE',    categorie:'APPLI',  nom:'Sécuriser les développements applicatifs',                 description:'Intégrer la sécurité dans le SDLC (tests SAST/DAST, revues de code, formation des développeurs).' },
  { ref:'R42', type:'ORGANISATIONNELLE', categorie:'APPLI', nom:'Contrôler les accès aux locaux techniques',               description:'Limiter et tracer l\'accès physique aux salles serveurs et locaux techniques. Alarme, badge, CCTV.' },
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
