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

export const FRAMEWORK_IDS = ['ISO27001', 'NIST_CSF', 'NIST_800_53', 'CIS_V8', 'ANSSI_HYG', 'HDS', 'PCI_DSS', 'DORA', 'IEC_62443', 'SOC2', 'NIST_SSDF', 'CUSTOM'] as const
export type FrameworkId = typeof FRAMEWORK_IDS[number]

export const FRAMEWORK_META: Record<FrameworkId, { nom: string; version: string; icon: string; cible: string }> = {
  ISO27001:   { nom: 'ISO/IEC 27001',        version: '2022',     icon: '🌐', cible: 'Tout secteur — certification SMSI' },
  NIST_CSF:   { nom: 'NIST CSF',             version: '2.0',      icon: '🇺🇸', cible: 'Organisations US et internationales' },
  NIST_800_53:{ nom: 'NIST SP 800-53',       version: 'Rév. 5',   icon: '🔐', cible: 'Systèmes fédéraux US, secteur défense' },
  CIS_V8:     { nom: 'CIS Controls',         version: 'v8',       icon: '🛡️', cible: 'PME et ETI — priorisation pratique' },
  ANSSI_HYG:  { nom: 'ANSSI Guide d\'hygiène', version: 'v2',     icon: '🇫🇷', cible: 'Organisations françaises — ANSSI' },
  HDS:        { nom: 'HDS',                  version: '2024',     icon: '🏥', cible: 'Hébergeurs de données de santé (France)' },
  PCI_DSS:    { nom: 'PCI-DSS',              version: 'v4.0',     icon: '💳', cible: 'Organisations traitant des paiements' },
  DORA:       { nom: 'DORA',                 version: 'UE 2022/2554', icon: '🏦', cible: 'Banque, assurance, fintech, marchés financiers (UE)' },
  IEC_62443:  { nom: 'IEC 62443',            version: '+ ANSSI-PA-107', icon: '🏭', cible: 'Systèmes industriels OT/ICS (usine, énergie, transport, eau)' },
  SOC2:       { nom: 'SOC 2 Type II',         version: 'TSC 2017 (rév. 2022)', icon: '🧾', cible: 'Éditeurs SaaS / cloud — assurance clients B2B' },
  NIST_SSDF:  { nom: 'NIST SSDF',             version: 'SP 800-218', icon: '🧬', cible: 'Développement logiciel sécurisé / DevSecOps (CI/CD)' },
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

export const NIST_CSF_CATEGORIES: Record<string, FrameworkCategory> = {
  GV: { label: 'Gouvernance (GV)',   icon: '🏛️', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  ID: { label: 'Identifier (ID)',    icon: '🔍', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  PR: { label: 'Protéger (PR)',      icon: '🛡️', color: 'text-green-700',  bg: 'bg-green-50'  },
  DE: { label: 'Détecter (DE)',      icon: '👁️', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  RS: { label: 'Répondre (RS)',      icon: '🚨', color: 'text-orange-700', bg: 'bg-orange-50' },
  RC: { label: 'Rétablir (RC)',      icon: '🔄', color: 'text-teal-700',   bg: 'bg-teal-50'   },
}

export const NIST_CSF_CONTROLES: FrameworkControl[] = [
  // ── GV — Gouvernance ──────────────────────────────────────────────────────
  { ref:'GV.OC-01', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Mission et contexte organisationnel',          description:'La mission, les objectifs et la tolérance au risque de l\'organisation sont établis et communiqués.' },
  { ref:'GV.OC-02', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Exigences légales et réglementaires',          description:'Les exigences légales, réglementaires et contractuelles relatives à la cybersécurité sont identifiées.' },
  { ref:'GV.OC-03', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Dépendances de la chaîne d\'approvisionnement', description:'Les dépendances et les risques critiques de la chaîne d\'approvisionnement sont identifiés et documentés.' },
  { ref:'GV.OC-04', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Parties prenantes et attentes',               description:'Les attentes des parties prenantes en matière de cybersécurité sont comprises et intégrées à la stratégie.' },
  { ref:'GV.OC-05', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Résultats et redevabilité',                   description:'Les résultats en matière de cybersécurité constituent une responsabilité à tous les niveaux de l\'organisation.' },
  { ref:'GV.RM-01', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Stratégie de gestion des risques',            description:'La stratégie, l\'appétit et le seuil de tolérance au risque cybersécurité sont établis et communiqués.' },
  { ref:'GV.RM-02', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Priorités et ressources de gestion des risques', description:'Les priorités et les ressources allouées à la gestion des risques cybersécurité sont établies.' },
  { ref:'GV.RM-03', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Risques cybersécurité intégrés à l\'ERM',     description:'Les risques cybersécurité sont intégrés au processus d\'Enterprise Risk Management (ERM) de l\'organisation.' },
  { ref:'GV.RM-06', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Politique de gestion des risques fournisseurs', description:'Une politique de gestion des risques de la chaîne d\'approvisionnement est établie et approuvée.' },
  { ref:'GV.RM-07', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Processus de gestion des risques fournisseurs', description:'Les processus d\'identification, d\'évaluation et de gestion des risques fournisseurs sont définis et gérés.' },
  { ref:'GV.RR-01', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Rôles et responsabilités cybersécurité',      description:'Les rôles et responsabilités en matière de cybersécurité sont établis, communiqués et appliqués.' },
  { ref:'GV.RR-02', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Responsabilité de la direction',              description:'Les dirigeants sont responsables et redevables de la stratégie cybersécurité et de ses résultats.' },
  { ref:'GV.PO-01', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Politique de cybersécurité',                  description:'Une politique de cybersécurité est établie, approuvée, communiquée et appliquée.' },
  { ref:'GV.PO-02', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Révision de la politique',                    description:'La politique de cybersécurité est réexaminée et actualisée régulièrement.' },
  { ref:'GV.OV-01', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Supervision de la gestion des risques',       description:'Les résultats de la gestion des risques cybersécurité sont examinés et utilisés pour ajuster la stratégie.' },
  { ref:'GV.SC-01', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Politique de risques chaîne d\'approvisionnement', description:'La politique de cybersécurité de la chaîne d\'approvisionnement est établie et communiquée aux parties prenantes.' },
  { ref:'GV.SC-04', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Fournisseurs et tiers connus',                description:'Les fournisseurs, clients et partenaires sont identifiés, classifiés et évalués selon leur criticité.' },
  { ref:'GV.SC-06', type:'ORGANISATIONNELLE', categorie:'GV', nom:'Planification et due diligence fournisseurs', description:'La planification de la cybersécurité est intégrée aux processus de sélection et gestion des fournisseurs.' },
  // ── ID — Identifier ───────────────────────────────────────────────────────
  { ref:'ID.AM-01', type:'TECHNOLOGIQUE',    categorie:'ID', nom:'Inventaire des actifs matériels',              description:'Un inventaire des actifs matériels (physiques) est maintenu avec les propriétaires et les criticités.' },
  { ref:'ID.AM-02', type:'TECHNOLOGIQUE',    categorie:'ID', nom:'Inventaire des actifs logiciels',              description:'Un inventaire des plateformes logicielles et applications est maintenu à jour.' },
  { ref:'ID.AM-03', type:'TECHNOLOGIQUE',    categorie:'ID', nom:'Cartographie des communications réseau',       description:'Les communications et flux de données réseaux sont cartographiés et documentés.' },
  { ref:'ID.AM-04', type:'TECHNOLOGIQUE',    categorie:'ID', nom:'Inventaire des services externes',             description:'Les services et actifs externes sont catalogués avec leurs risques associés.' },
  { ref:'ID.AM-05', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Priorisation des actifs par criticité',       description:'Les actifs sont classifiés selon leur criticité pour la mission et la tolérance au risque.' },
  { ref:'ID.AM-07', type:'TECHNOLOGIQUE',    categorie:'ID', nom:'Inventaire des données et leur classification', description:'Les données et leurs responsables sont identifiés et classifiés selon leur sensibilité.' },
  { ref:'ID.AM-08', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Systèmes, matériels et logiciels gérés',      description:'Les systèmes, matériels et logiciels sont gérés tout au long de leur cycle de vie.' },
  { ref:'ID.RA-01', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Identification des vulnérabilités',           description:'Les vulnérabilités affectant les actifs sont identifiées, validées et consignées.' },
  { ref:'ID.RA-02', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Cyber threat intelligence (CTI)',             description:'Les informations de cyber threat intelligence sont reçues de forums et sources spécialisés.' },
  { ref:'ID.RA-03', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Identification des menaces internes et externes', description:'Les menaces internes et externes sont identifiées et documentées.' },
  { ref:'ID.RA-04', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Impacts potentiels et probabilités',          description:'Les impacts potentiels et probabilités des menaces exploitant les vulnérabilités sont identifiés.' },
  { ref:'ID.RA-05', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Risques liés aux menaces, vulnérabilités et impacts', description:'Les menaces, vulnérabilités, probabilités et impacts sont utilisés pour comprendre les risques.' },
  { ref:'ID.RA-06', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Réponses aux risques identifiées et priorisées', description:'Les réponses aux risques sont identifiées, priorisées et sélectionnées.' },
  { ref:'ID.IM-01', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Plans d\'amélioration cybersécurité',         description:'Des plans d\'amélioration sont identifiés, mis en œuvre, réexaminés et actualisés.' },
  { ref:'ID.IM-02', type:'ORGANISATIONNELLE', categorie:'ID', nom:'Retours d\'expérience cybersécurité',         description:'Les activités de cybersécurité sont évaluées et les leçons apprises documentées.' },
  // ── PR — Protéger ─────────────────────────────────────────────────────────
  { ref:'PR.AA-01', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Inventaire et gestion des identités',          description:'Les identités et les accréditations des utilisateurs, services et matériels autorisés sont gérées.' },
  { ref:'PR.AA-02', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Identités vérifiées avant provisionnement',    description:'Les identités sont prouvées et liées aux accréditations avant d\'accorder les accès.' },
  { ref:'PR.AA-03', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Authentification des utilisateurs, services et matériels', description:'Les utilisateurs, services et matériels sont authentifiés (MFA requis pour les accès sensibles).' },
  { ref:'PR.AA-04', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Gestion des identités et accréditations',      description:'Les accréditations (mots de passe, clés, certificats) sont gérées et protégées.' },
  { ref:'PR.AA-05', type:'ORGANISATIONNELLE', categorie:'PR', nom:'Accès accordés selon le moindre privilège',   description:'L\'accès aux actifs est accordé selon le principe du moindre privilège et du besoin d\'en connaître.' },
  { ref:'PR.AA-06', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Authentification résistante à l\'hameçonnage', description:'L\'accès aux actifs physiques et logiques est géré via des mécanismes résistant au phishing.' },
  { ref:'PR.AT-01', type:'HUMAINE',          categorie:'PR', nom:'Sensibilisation de tout le personnel',         description:'Tout le personnel est informé et formé pour réduire les risques cybersécurité.' },
  { ref:'PR.AT-02', type:'HUMAINE',          categorie:'PR', nom:'Formation du personnel avec accès privilégiés', description:'Les personnels ayant des accès à des actifs critiques sont formés aux risques et responsabilités.' },
  { ref:'PR.DS-01', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Protection des données au repos',              description:'Les données au repos sont protégées par des contrôles appropriés (chiffrement, contrôle d\'accès).' },
  { ref:'PR.DS-02', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Protection des données en transit',            description:'Les données en transit sont protégées (TLS, chiffrement de bout en bout).' },
  { ref:'PR.DS-10', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Données en cours de traitement protégées',     description:'Les données en cours de traitement sont protégées contre la divulgation, la modification et la perte.' },
  { ref:'PR.DS-11', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Sauvegardes et restauration des données',      description:'Les sauvegardes des données sont réalisées, protégées et testées régulièrement.' },
  { ref:'PR.PS-01', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Configuration sécurisée des actifs',          description:'La configuration des actifs est établie, documentée, et conforme aux règles de durcissement.' },
  { ref:'PR.PS-02', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Logiciels maintenus et à jour',                description:'Les logiciels sont maintenus (correctifs) pour éviter l\'exploitation de vulnérabilités.' },
  { ref:'PR.PS-04', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Journaux générés et conservés',               description:'Les journaux permettant de détecter, analyser et récupérer d\'incidents sont générés et conservés.' },
  { ref:'PR.PS-06', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Pratiques de développement sécurisé',          description:'Les pratiques de développement sécurisé sont utilisées et leurs performances surveillées.' },
  { ref:'PR.IR-01', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Réseaux et infrastructure protégés',           description:'Les réseaux et environnements sont protégés contre les accès non autorisés et les attaques.' },
  { ref:'PR.IR-02', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Actifs gérés par le SMSI protégés',            description:'Les actifs du périmètre SMSI sont protégés contre la divulgation non autorisée.' },
  { ref:'PR.IR-03', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Mécanismes officiels de continuité mis en œuvre', description:'Des mécanismes de continuité de fonctionnement sont mis en place et testés.' },
  { ref:'PR.IR-04', type:'TECHNOLOGIQUE',    categorie:'PR', nom:'Capacité adéquate pour assurer la résilience', description:'Une capacité suffisante pour répondre aux demandes est maintenue pour garantir la résilience.' },
  // ── DE — Détecter ─────────────────────────────────────────────────────────
  { ref:'DE.CM-01', type:'TECHNOLOGIQUE',    categorie:'DE', nom:'Réseaux surveillés pour détecter les événements', description:'Les réseaux et l\'environnement réseau sont surveillés pour détecter les événements cybersécurité.' },
  { ref:'DE.CM-02', type:'PHYSIQUE',         categorie:'DE', nom:'Environnement physique surveillé',             description:'L\'environnement physique est surveillé pour détecter les accès potentiellement non autorisés.' },
  { ref:'DE.CM-03', type:'TECHNOLOGIQUE',    categorie:'DE', nom:'Activités du personnel surveillées',          description:'Les activités du personnel sont surveillées pour détecter des événements cybersécurité potentiels.' },
  { ref:'DE.CM-06', type:'TECHNOLOGIQUE',    categorie:'DE', nom:'Activités des fournisseurs externes surveillées', description:'Les activités des prestataires sont surveillées pour détecter des événements cybersécurité.' },
  { ref:'DE.CM-09', type:'TECHNOLOGIQUE',    categorie:'DE', nom:'Services informatiques surveillés',            description:'Les services informatiques sont surveillés pour détecter les événements potentiels de cybersécurité.' },
  { ref:'DE.AE-02', type:'TECHNOLOGIQUE',    categorie:'DE', nom:'Analyse des événements anormaux',              description:'Les événements anormaux sont analysés pour caractériser les attaques potentielles.' },
  { ref:'DE.AE-03', type:'TECHNOLOGIQUE',    categorie:'DE', nom:'Données d\'événements agrégées et corrélées',  description:'Les données d\'événements de plusieurs sources sont agrégées et corrélées.' },
  { ref:'DE.AE-04', type:'TECHNOLOGIQUE',    categorie:'DE', nom:'Impact des événements estimé',                 description:'L\'impact des événements est estimé pour prioriser la réponse.' },
  { ref:'DE.AE-06', type:'TECHNOLOGIQUE',    categorie:'DE', nom:'Informations sur les incidents communiquées',  description:'Les informations sur les incidents sont communiquées et les parties concernées notifiées.' },
  { ref:'DE.AE-07', type:'ORGANISATIONNELLE', categorie:'DE', nom:'CTI intégrée à la détection',                 description:'La cyber threat intelligence est intégrée aux activités de détection.' },
  { ref:'DE.AE-08', type:'TECHNOLOGIQUE',    categorie:'DE', nom:'Incidents déclarés',                           description:'Les incidents sont déclarés selon les critères définis dans le plan de réponse.' },
  // ── RS — Répondre ─────────────────────────────────────────────────────────
  { ref:'RS.MA-01', type:'ORGANISATIONNELLE', categorie:'RS', nom:'Plan de réponse aux incidents exécuté',       description:'Le plan de réponse aux incidents est exécuté en coordination avec les parties prenantes.' },
  { ref:'RS.MA-02', type:'ORGANISATIONNELLE', categorie:'RS', nom:'Incidents triés',                             description:'Les incidents sont triés pour définir la réponse la plus appropriée.' },
  { ref:'RS.MA-03', type:'ORGANISATIONNELLE', categorie:'RS', nom:'Incidents classifiés et escaladés',           description:'Les incidents sont catégorisés et classifiés pour déterminer les priorités de réponse.' },
  { ref:'RS.MA-04', type:'ORGANISATIONNELLE', categorie:'RS', nom:'Incidents escaladés ou délégués',             description:'Les incidents sont escaladés ou délégués si nécessaire.' },
  { ref:'RS.MA-05', type:'ORGANISATIONNELLE', categorie:'RS', nom:'Critères d\'arrêt de la réponse définis',     description:'Des critères d\'initiation et d\'arrêt de la réponse aux incidents sont définis.' },
  { ref:'RS.AN-03', type:'ORGANISATIONNELLE', categorie:'RS', nom:'Analyse pour établir les causes',             description:'Une analyse est réalisée pour établir les causes d\'un incident et les activités affectées.' },
  { ref:'RS.AN-06', type:'ORGANISATIONNELLE', categorie:'RS', nom:'Actions de réponse documentées',              description:'Les actions de réponse aux incidents sont documentées.' },
  { ref:'RS.AN-07', type:'TECHNOLOGIQUE',    categorie:'RS', nom:'Contenu des incidents estimé pour la criminalistique', description:'Le contenu des incidents est estimé pour permettre des activités de criminalistique légale.' },
  { ref:'RS.CO-02', type:'ORGANISATIONNELLE', categorie:'RS', nom:'Parties prenantes internes notifiées',        description:'Les parties prenantes internes sont notifiées des incidents.' },
  { ref:'RS.CO-03', type:'ORGANISATIONNELLE', categorie:'RS', nom:'Parties prenantes externes notifiées',        description:'Les parties prenantes externes (autorités, clients, assureurs) sont notifiées si nécessaire.' },
  { ref:'RS.MI-01', type:'TECHNOLOGIQUE',    categorie:'RS', nom:'Incidents contenus',                           description:'Les incidents sont contenus pour limiter leur propagation et leur impact.' },
  { ref:'RS.MI-02', type:'TECHNOLOGIQUE',    categorie:'RS', nom:'Incidents éradiqués',                          description:'Les incidents sont éradiqués pour supprimer leur cause et prévenir la récidive.' },
  // ── RC — Rétablir ─────────────────────────────────────────────────────────
  { ref:'RC.RP-01', type:'ORGANISATIONNELLE', categorie:'RC', nom:'Plan de reprise après incident exécuté',      description:'Le plan de reprise après incident est exécuté selon les contraintes définies.' },
  { ref:'RC.RP-02', type:'ORGANISATIONNELLE', categorie:'RC', nom:'Stratégie de reprise mise à jour',            description:'La stratégie de reprise est actualisée pour intégrer les leçons apprises.' },
  { ref:'RC.RP-03', type:'ORGANISATIONNELLE', categorie:'RC', nom:'Parties prenantes impliquées dans la reprise', description:'Les parties prenantes participent au plan de reprise et à son exécution.' },
  { ref:'RC.RP-04', type:'ORGANISATIONNELLE', categorie:'RC', nom:'Intégrité des sauvegardes vérifiée',          description:'L\'intégrité des sauvegardes et les ressources nécessaires à la reprise sont vérifiées.' },
  { ref:'RC.RP-05', type:'ORGANISATIONNELLE', categorie:'RC', nom:'Intégrité des systèmes restaurés vérifiée',   description:'L\'intégrité des systèmes et des données restaurés est vérifiée avant reprise.' },
  { ref:'RC.RP-06', type:'ORGANISATIONNELLE', categorie:'RC', nom:'Activités restaurées dans les délais',        description:'Les activités sont restaurées dans les délais définis par les objectifs de reprise (RTO/RPO).' },
  { ref:'RC.CO-03', type:'ORGANISATIONNELLE', categorie:'RC', nom:'Activités de reprise communiquées',           description:'Les activités de reprise sont communiquées aux parties prenantes internes et externes.' },
  { ref:'RC.CO-04', type:'ORGANISATIONNELLE', categorie:'RC', nom:'Réputation restaurée',                        description:'La réputation de l\'organisation est restaurée après un incident cybersécurité.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// CIS Controls v8
// Source : Center for Internet Security Controls v8 (2021)
// ─────────────────────────────────────────────────────────────────────────────

export const CIS_V8_CATEGORIES: Record<string, FrameworkCategory> = {
  IG1: { label: 'Groupe 1 — Hygiène de base (IG1)',      icon: '🟢', color: 'text-green-700',  bg: 'bg-green-50'  },
  IG2: { label: 'Groupe 2 — Défense en profondeur (IG2)', icon: '🟡', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  IG3: { label: 'Groupe 3 — Avancé (IG3)',               icon: '🔴', color: 'text-red-700',    bg: 'bg-red-50'    },
}

export const CIS_V8_CONTROLES: FrameworkControl[] = [
  // CIS 1 — Inventaire et contrôle des actifs matériels
  { ref:'CIS-1.1', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[1] Établir et maintenir l\'inventaire des actifs matériels', description:'Inventaire de tous les actifs matériels connectés au réseau, mis à jour régulièrement.' },
  { ref:'CIS-1.2', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[1] Gérer les actifs non autorisés',                         description:'S\'assurer que les actifs non autorisés sont détectés et gérés (quarantaine, retrait).' },
  // CIS 2 — Inventaire et contrôle des logiciels
  { ref:'CIS-2.1', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[2] Inventaire des logiciels autorisés',                     description:'Inventaire de tous les logiciels autorisés, maintenu et actualisé.' },
  { ref:'CIS-2.2', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[2] Blocage des logiciels non autorisés',                    description:'Seuls les logiciels autorisés sont utilisés — application d\'une liste blanche.' },
  { ref:'CIS-2.3', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[2] Prise en charge des logiciels (EoL)',                    description:'Les logiciels en fin de support sont identifiés et remplacés ou isolés.' },
  // CIS 3 — Protection des données
  { ref:'CIS-3.1', type:'ORGANISATIONNELLE', categorie:'IG1', nom:'[3] Classification des données',                            description:'Les données sont classifiées selon la sensibilité pour guider les contrôles de protection.' },
  { ref:'CIS-3.2', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[3] Inventaire des données sensibles',                      description:'Un inventaire des données sensibles est maintenu à jour.' },
  { ref:'CIS-3.3', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[3] Chiffrement des données sur équipements portables',      description:'Les données sensibles sur les appareils portables sont chiffrées.' },
  { ref:'CIS-3.4', type:'TECHNOLOGIQUE',    categorie:'IG2', nom:'[3] Chiffrement des données au repos',                      description:'Le chiffrement est appliqué aux données au repos sur tous les serveurs et postes.' },
  { ref:'CIS-3.5', type:'TECHNOLOGIQUE',    categorie:'IG2', nom:'[3] Chiffrement des données en transit',                    description:'Le chiffrement est appliqué aux données sensibles en transit sur le réseau.' },
  { ref:'CIS-3.11', type:'TECHNOLOGIQUE',   categorie:'IG2', nom:'[3] Chiffrement des données sensibles en transit',          description:'Les données sensibles en transit sur les réseaux non fiables sont chiffrées.' },
  // CIS 4 — Configuration sécurisée
  { ref:'CIS-4.1', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[4] Configurer les équipements de réseau',                  description:'Les équipements réseau utilisent la configuration la plus sécurisée disponible.' },
  { ref:'CIS-4.2', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[4] Maintenir une configuration de référence sécurisée',    description:'Une configuration de référence sécurisée est définie et maintenue pour tous les types d\'équipements.' },
  { ref:'CIS-4.3', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[4] Protéger l\'accès physique aux équipements',            description:'L\'accès physique aux actifs critiques est limité et contrôlé.' },
  { ref:'CIS-4.8', type:'TECHNOLOGIQUE',    categorie:'IG2', nom:'[4] Désinstaller les logiciels inutiles',                   description:'Les logiciels non nécessaires sont désinstallés ou désactivés sur tous les actifs.' },
  // CIS 5 — Gestion des comptes
  { ref:'CIS-5.1', type:'ORGANISATIONNELLE', categorie:'IG1', nom:'[5] Inventaire des comptes',                               description:'Un inventaire des comptes utilisateurs autorisés est maintenu à jour.' },
  { ref:'CIS-5.2', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[5] Révocation des comptes en cas de départ',              description:'Les comptes sont révoqués dans les 24 heures suivant le départ d\'un employé.' },
  { ref:'CIS-5.3', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[5] Interdiction des comptes partagés',                     description:'Les comptes partagés ne sont pas utilisés. Tout compte est nominatif et associé à un responsable.' },
  { ref:'CIS-5.4', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[5] Restriction des droits d\'administration',              description:'Les droits d\'administration ne sont utilisés que pour les tâches administratives nécessaires.' },
  { ref:'CIS-5.6', type:'TECHNOLOGIQUE',    categorie:'IG2', nom:'[5] Centralisation de la gestion des accès',               description:'La gestion des accès (authentification centralisée, annuaire) est centralisée.' },
  // CIS 6 — Contrôle des accès
  { ref:'CIS-6.1', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[6] Établir une politique de contrôle des accès',           description:'Une politique de contrôle des accès basée sur le besoin d\'en connaître est définie et appliquée.' },
  { ref:'CIS-6.2', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[6] Vérification des accès (MFA)',                         description:'L\'authentification multi-facteurs (MFA) est requise pour tous les accès distants et critiques.' },
  { ref:'CIS-6.3', type:'TECHNOLOGIQUE',    categorie:'IG2', nom:'[6] MFA pour les applications exposées',                   description:'La MFA est imposée sur toutes les applications accessibles depuis Internet.' },
  { ref:'CIS-6.7', type:'ORGANISATIONNELLE', categorie:'IG2', nom:'[6] Principe du moindre privilège',                       description:'L\'accès aux systèmes et applications est accordé sur le principe du moindre privilège.' },
  // CIS 7 — Gestion continue des vulnérabilités
  { ref:'CIS-7.1', type:'ORGANISATIONNELLE', categorie:'IG1', nom:'[7] Processus de gestion des vulnérabilités',              description:'Un processus documenté de gestion des vulnérabilités est établi et opérationnel.' },
  { ref:'CIS-7.2', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[7] Scans de vulnérabilités automatisés',                  description:'Des scans de vulnérabilités automatisés sont réalisés sur tous les actifs régulièrement.' },
  { ref:'CIS-7.4', type:'TECHNOLOGIQUE',    categorie:'IG2', nom:'[7] Scans des applications web',                           description:'Des scans de sécurité des applications web sont réalisés régulièrement.' },
  { ref:'CIS-7.5', type:'TECHNOLOGIQUE',    categorie:'IG2', nom:'[7] Correction des vulnérabilités critiques sous 30 jours', description:'Les vulnérabilités critiques sont corrigées dans les 30 jours (CVSSv3 ≥ 9.0).' },
  // CIS 8 — Gestion des journaux d\'audit
  { ref:'CIS-8.1', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[8] Journalisation des événements de sécurité',             description:'Les journaux d\'audit sont activés sur tous les actifs critiques (OS, applications, réseau).' },
  { ref:'CIS-8.2', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[8] Conservation des journaux (90 jours minimum)',          description:'Les journaux sont conservés au moins 90 jours en local (et 1 an en archive longue durée).' },
  { ref:'CIS-8.9', type:'TECHNOLOGIQUE',    categorie:'IG2', nom:'[8] Centralisation des journaux (SIEM)',                   description:'Les journaux sont centralisés dans un SIEM pour permettre la corrélation et la détection.' },
  // CIS 9 — Protection des navigateurs et messagerie
  { ref:'CIS-9.1', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[9] Utilisation de navigateurs et clients email sécurisés', description:'Seuls des navigateurs et clients email maintenus et configurés de façon sécurisée sont utilisés.' },
  { ref:'CIS-9.2', type:'TECHNOLOGIQUE',    categorie:'IG1', nom:'[9] Filtrage DNS',                                          description:'Un service de filtrage DNS est utilisé pour bloquer l\'accès aux domaines malveillants.' },
  { ref:'CIS-9.7', type:'TECHNOLOGIQUE',    categorie:'IG2', nom:'[9] Filtrage des URLs',                                    description:'Un filtre de contenu URL est déployé pour bloquer les sites non autorisés ou malveillants.' },
  // CIS 10 — Défenses anti-malware
  { ref:'CIS-10.1', type:'TECHNOLOGIQUE',   categorie:'IG1', nom:'[10] Déploiement d\'anti-malware sur tous les actifs',      description:'Des logiciels anti-malware sont déployés sur tous les actifs (postes, serveurs, mobiles).' },
  { ref:'CIS-10.2', type:'TECHNOLOGIQUE',   categorie:'IG1', nom:'[10] Mise à jour automatique des signatures',               description:'Les signatures anti-malware sont mises à jour automatiquement et régulièrement.' },
  { ref:'CIS-10.6', type:'TECHNOLOGIQUE',   categorie:'IG2', nom:'[10] Solution EDR/XDR déployée',                           description:'Une solution EDR/XDR est déployée sur les actifs critiques pour la détection comportementale.' },
  // CIS 11 — Sauvegarde et restauration
  { ref:'CIS-11.1', type:'TECHNOLOGIQUE',   categorie:'IG1', nom:'[11] Processus de sauvegarde des données critiques',        description:'Un processus de sauvegarde est en place pour toutes les données critiques (règle 3-2-1).' },
  { ref:'CIS-11.4', type:'TECHNOLOGIQUE',   categorie:'IG1', nom:'[11] Tests de restauration réguliers',                     description:'Les sauvegardes sont testées en restauration au moins une fois par trimestre.' },
  { ref:'CIS-11.3', type:'TECHNOLOGIQUE',   categorie:'IG2', nom:'[11] Sauvegardes protégées (air-gap ou immuables)',         description:'Les sauvegardes sont protégées contre la falsification et le ransomware (air-gap, immuabilité).' },
  // CIS 12 — Infrastructure réseau
  { ref:'CIS-12.2', type:'TECHNOLOGIQUE',   categorie:'IG1', nom:'[12] Scan des configurations réseau',                      description:'Les configurations des équipements réseau sont vérifiées régulièrement.' },
  { ref:'CIS-12.3', type:'TECHNOLOGIQUE',   categorie:'IG2', nom:'[12] Segmentation réseau',                                 description:'Les réseaux sont segmentés (VLAN, micro-segmentation) pour limiter les mouvements latéraux.' },
  { ref:'CIS-12.8', type:'TECHNOLOGIQUE',   categorie:'IG2', nom:'[12] Déploiement IDS/IPS',                                 description:'Des systèmes IDS/IPS sont déployés pour détecter et prévenir les intrusions.' },
  // CIS 13 — Surveillance et défense réseau
  { ref:'CIS-13.1', type:'TECHNOLOGIQUE',   categorie:'IG2', nom:'[13] Analyse centralisée des alertes réseau',               description:'Les alertes réseau sont centralisées et analysées par une équipe dédiée (SOC ou MSSP).' },
  { ref:'CIS-13.3', type:'TECHNOLOGIQUE',   categorie:'IG3', nom:'[13] Déploiement d\'un SIEM',                              description:'Un SIEM est déployé pour la collecte, la corrélation et l\'analyse des événements de sécurité.' },
  // CIS 14 — Sensibilisation et formation
  { ref:'CIS-14.1', type:'HUMAINE',         categorie:'IG1', nom:'[14] Programme de sensibilisation cybersécurité',          description:'Un programme de sensibilisation à la cybersécurité est mis en œuvre pour tous les employés.' },
  { ref:'CIS-14.2', type:'HUMAINE',         categorie:'IG1', nom:'[14] Formation à la reconnaissance du phishing',           description:'Les employés sont formés à reconnaître les tentatives de phishing et ingénierie sociale.' },
  { ref:'CIS-14.3', type:'HUMAINE',         categorie:'IG1', nom:'[14] Simulations de phishing régulières',                  description:'Des simulations de phishing sont réalisées régulièrement pour évaluer la vigilance.' },
  { ref:'CIS-14.6', type:'HUMAINE',         categorie:'IG2', nom:'[14] Formation du personnel à hauts risques',              description:'Les fonctions à haut risque (RH, finances, IT) reçoivent une formation supplémentaire ciblée.' },
  // CIS 15 — Gestion des fournisseurs
  { ref:'CIS-15.1', type:'ORGANISATIONNELLE', categorie:'IG1', nom:'[15] Inventaire des fournisseurs de services',            description:'Un inventaire des fournisseurs de services tiers est maintenu, incluant les données traitées.' },
  { ref:'CIS-15.2', type:'ORGANISATIONNELLE', categorie:'IG2', nom:'[15] Politique de sécurité fournisseurs',                description:'Une politique de sécurité fournisseurs définissant les exigences minimales est établie.' },
  { ref:'CIS-15.4', type:'ORGANISATIONNELLE', categorie:'IG2', nom:'[15] Clause de sécurité dans les contrats',              description:'Des clauses de sécurité et droits d\'audit sont intégrés dans les contrats fournisseurs.' },
  // CIS 16 — Sécurité des applications
  { ref:'CIS-16.1', type:'ORGANISATIONNELLE', categorie:'IG2', nom:'[16] Inventaire des applications métier',                description:'Un inventaire des applications développées en interne ou externalisées est maintenu.' },
  { ref:'CIS-16.6', type:'TECHNOLOGIQUE',   categorie:'IG2', nom:'[16] Analyse statique du code (SAST)',                    description:'Les outils d\'analyse statique sont intégrés dans le pipeline CI/CD pour toutes les applications.' },
  { ref:'CIS-16.10', type:'TECHNOLOGIQUE',  categorie:'IG3', nom:'[16] Tests de pénétration annuels des applications',      description:'Des tests de pénétration sont réalisés annuellement sur les applications critiques.' },
  // CIS 17 — Réponse aux incidents
  { ref:'CIS-17.1', type:'ORGANISATIONNELLE', categorie:'IG1', nom:'[17] Plan de réponse aux incidents',                    description:'Un plan de réponse aux incidents est défini, approuvé et communiqué.' },
  { ref:'CIS-17.3', type:'ORGANISATIONNELLE', categorie:'IG2', nom:'[17] Exercices de simulation d\'incidents',             description:'Des exercices de simulation d\'incidents (tabletop, red team) sont réalisés annuellement.' },
  { ref:'CIS-17.4', type:'ORGANISATIONNELLE', categorie:'IG2', nom:'[17] Processus documenté de gestion des incidents',     description:'Le processus de gestion des incidents est documenté, testé et amélioré après chaque incident.' },
  // CIS 18 — Tests de pénétration
  { ref:'CIS-18.1', type:'TECHNOLOGIQUE',   categorie:'IG2', nom:'[18] Tests de pénétration du périmètre réseau',          description:'Des tests de pénétration du périmètre réseau externe sont réalisés annuellement.' },
  { ref:'CIS-18.2', type:'TECHNOLOGIQUE',   categorie:'IG3', nom:'[18] Tests de pénétration internes',                     description:'Des tests de pénétration internes sont réalisés annuellement par un prestataire qualifié.' },
  { ref:'CIS-18.3', type:'TECHNOLOGIQUE',   categorie:'IG3', nom:'[18] Programme de Red Team',                             description:'Un programme Red Team est mis en place pour simuler des attaques avancées (APT).' },
]

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

export const HDS_CATEGORIES: Record<string, FrameworkCategory> = {
  'GOV':  { label: 'Gouvernance et organisation',        icon: '🏛️', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  'INFRA':{ label: 'Infrastructure physique',            icon: '🏢', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  'VIRT': { label: 'Infrastructure virtuelle',           icon: '☁️', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  'APP':  { label: 'Plateforme applicative',             icon: '💊', color: 'text-teal-700',   bg: 'bg-teal-50'   },
  'SAVE': { label: 'Sauvegarde externalisée',            icon: '💾', color: 'text-purple-700', bg: 'bg-purple-50' },
  'OPER': { label: 'Exploitation et MCO',                icon: '⚙️', color: 'text-orange-700', bg: 'bg-orange-50' },
}

export const HDS_CONTROLES: FrameworkControl[] = [
  { ref:'HDS-GOV-1',  type:'ORGANISATIONNELLE', categorie:'GOV',   nom:'Certification ISO 27001 du périmètre HDS',           description:'L\'hébergeur doit être certifié ISO 27001:2022 sur le périmètre des activités d\'hébergement de données de santé.' },
  { ref:'HDS-GOV-2',  type:'ORGANISATIONNELLE', categorie:'GOV',   nom:'Politique de sécurité dédiée données de santé',       description:'Une politique de sécurité spécifique aux données de santé est définie, approuvée et communiquée.' },
  { ref:'HDS-GOV-3',  type:'ORGANISATIONNELLE', categorie:'GOV',   nom:'Contrats hébergeurs conformes HDS',                  description:'Les contrats avec les producteurs de soins incluent les clauses HDS obligatoires (responsabilités, accès, destruction).' },
  { ref:'HDS-GOV-4',  type:'ORGANISATIONNELLE', categorie:'GOV',   nom:'Habilitation du personnel traitant les données de santé', description:'Le personnel accédant aux données de santé est formé, habilité et soumis au secret professionnel.' },
  { ref:'HDS-GOV-5',  type:'ORGANISATIONNELLE', categorie:'GOV',   nom:'Gestion des incidents de sécurité sur données de santé', description:'Un processus de gestion des incidents spécifique aux données de santé est établi, avec notification CNIL et ANS sous 72h.' },
  { ref:'HDS-GOV-6',  type:'ORGANISATIONNELLE', categorie:'GOV',   nom:'Audit interne annuel du dispositif HDS',              description:'Un audit interne annuel vérifie la conformité aux exigences HDS et identifie les actions d\'amélioration.' },
  { ref:'HDS-INFRA-1', type:'PHYSIQUE',         categorie:'INFRA', nom:'Datacenters sur le territoire national (RGPD)',        description:'Les infrastructures physiques hébergeant des données de santé sont situées sur le territoire de l\'UE.' },
  { ref:'HDS-INFRA-2', type:'PHYSIQUE',         categorie:'INFRA', nom:'Redondance géographique des datacenters',              description:'Deux sites physiques géographiquement séparés sont utilisés pour la haute disponibilité et la PCA.' },
  { ref:'HDS-INFRA-3', type:'PHYSIQUE',         categorie:'INFRA', nom:'Contrôles d\'accès physiques aux datacenters',         description:'Les accès physiques aux salles serveurs sont strictement contrôlés (badge, biométrie, sas, CCTV).' },
  { ref:'HDS-INFRA-4', type:'PHYSIQUE',         categorie:'INFRA', nom:'Alimentation électrique secourue (N+1)',               description:'L\'alimentation électrique est secourue (UPS + groupe électrogène) avec une autonomie ≥ 72h.' },
  { ref:'HDS-INFRA-5', type:'PHYSIQUE',         categorie:'INFRA', nom:'Climatisation redondante et surveillance thermique',   description:'La climatisation est redondante et la température/hygrométrie supervisée en temps réel avec alertes.' },
  { ref:'HDS-VIRT-1',  type:'TECHNOLOGIQUE',    categorie:'VIRT',  nom:'Isolation des environnements clients',                description:'Les environnements virtuels des différents hébergés sont strictement isolés (hyperviseur, réseau, stockage).' },
  { ref:'HDS-VIRT-2',  type:'TECHNOLOGIQUE',    categorie:'VIRT',  nom:'Chiffrement des données au repos',                    description:'Toutes les données de santé au repos sont chiffrées (AES-256 minimum, gestion des clés séparée).' },
  { ref:'HDS-VIRT-3',  type:'TECHNOLOGIQUE',    categorie:'VIRT',  nom:'Chiffrement des flux réseau',                        description:'Tous les flux réseau transportant des données de santé sont chiffrés (TLS 1.2 minimum, TLS 1.3 recommandé).' },
  { ref:'HDS-VIRT-4',  type:'TECHNOLOGIQUE',    categorie:'VIRT',  nom:'Gestion des vulnérabilités de l\'infrastructure',     description:'Un processus de gestion des vulnérabilités de l\'infrastructure virtuelle est opérationnel (scan, patch <30j pour critiques).' },
  { ref:'HDS-VIRT-5',  type:'TECHNOLOGIQUE',    categorie:'VIRT',  nom:'Surveillance et journalisation de l\'infrastructure', description:'L\'infrastructure virtuelle est supervisée 24/7 avec journalisation complète des accès et opérations.' },
  { ref:'HDS-APP-1',   type:'TECHNOLOGIQUE',    categorie:'APP',   nom:'Déploiement d\'applications de santé certifiées/qualifiées', description:'Les applications de santé hébergées sont conformes aux référentiels HAS/ANS (DPI, SIH, télémedecine).' },
  { ref:'HDS-APP-2',   type:'TECHNOLOGIQUE',    categorie:'APP',   nom:'Authentification forte des professionnels de santé',  description:'Les professionnels de santé accèdent aux données via une authentification forte (CPS, MSSanté, eIDAS).' },
  { ref:'HDS-APP-3',   type:'ORGANISATIONNELLE', categorie:'APP',  nom:'Gestion des accès aux données de santé (RBAC)',       description:'Les accès aux données de santé sont gérés selon le rôle (RBAC) avec le principe du moindre privilège.' },
  { ref:'HDS-APP-4',   type:'ORGANISATIONNELLE', categorie:'APP',  nom:'Traçabilité des accès aux données de santé',          description:'Tous les accès aux données de santé sont tracés (qui, quoi, quand) et conservés ≥ 20 ans.' },
  { ref:'HDS-APP-5',   type:'ORGANISATIONNELLE', categorie:'APP',  nom:'DPC / Formation RGPD santé des équipes',              description:'Les équipes sont formées aux exigences spécifiques RGPD santé, secret médical et obligations légales.' },
  { ref:'HDS-SAVE-1',  type:'TECHNOLOGIQUE',    categorie:'SAVE',  nom:'Sauvegardes chiffrées et externalisées',              description:'Les sauvegardes des données de santé sont chiffrées et stockées sur un site secondaire géographiquement distant.' },
  { ref:'HDS-SAVE-2',  type:'TECHNOLOGIQUE',    categorie:'SAVE',  nom:'Sauvegardes testées en restauration trimestriellement', description:'La restauration des sauvegardes est testée au moins une fois par trimestre avec validation fonctionnelle.' },
  { ref:'HDS-SAVE-3',  type:'TECHNOLOGIQUE',    categorie:'SAVE',  nom:'RPO ≤ 24h, RTO défini contractuellement',             description:'Le RPO est ≤ 24h et le RTO est contractuellement défini et testé pour les données de santé critiques.' },
  { ref:'HDS-OPER-1',  type:'ORGANISATIONNELLE', categorie:'OPER', nom:'Astreinte 24/7 pour les incidents critiques',         description:'Une astreinte 24/7 est en place pour la prise en charge des incidents critiques sur les données de santé.' },
  { ref:'HDS-OPER-2',  type:'ORGANISATIONNELLE', categorie:'OPER', nom:'Procédures de gestion des changements (ITIL)',        description:'Tout changement sur l\'infrastructure est soumis à une procédure formelle de gestion des changements (ITIL Change Mgmt).' },
  { ref:'HDS-OPER-3',  type:'ORGANISATIONNELLE', categorie:'OPER', nom:'Destruction certifiée des données en fin de contrat', description:'La destruction sécurisée des données de santé est certifiée (NIST 800-88 ou équivalent) à la fin du contrat.' },
  { ref:'HDS-OPER-4',  type:'ORGANISATIONNELLE', categorie:'OPER', nom:'Plan de réversibilité documenté',                    description:'Un plan de réversibilité permettant au producteur de soins de récupérer ses données est formalisé et testé.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// PCI-DSS v4.0
// Source : PCI Security Standards Council — PCI Data Security Standard v4.0 (2022)
// ─────────────────────────────────────────────────────────────────────────────

export const PCI_DSS_CATEGORIES: Record<string, FrameworkCategory> = {
  'R1':  { label: 'R1 — Sécurité réseau',                 icon: '🌐', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  'R2':  { label: 'R2 — Configuration sécurisée',          icon: '⚙️', color: 'text-teal-700',   bg: 'bg-teal-50'   },
  'R3':  { label: 'R3 — Protection des données de carte',  icon: '💳', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  'R4':  { label: 'R4 — Chiffrement des transmissions',    icon: '🔐', color: 'text-green-700',  bg: 'bg-green-50'  },
  'R5':  { label: 'R5 — Protection contre les malwares',   icon: '🛡️', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  'R6':  { label: 'R6 — Développement sécurisé',           icon: '💻', color: 'text-cyan-700',   bg: 'bg-cyan-50'   },
  'R7':  { label: 'R7 — Contrôle des accès',               icon: '🔑', color: 'text-purple-700', bg: 'bg-purple-50' },
  'R8':  { label: 'R8 — Identification et authentification', icon: '👤', color: 'text-rose-700', bg: 'bg-rose-50'   },
  'R9':  { label: 'R9 — Sécurité physique',                icon: '🏢', color: 'text-orange-700', bg: 'bg-orange-50' },
  'R10': { label: 'R10 — Journalisation et surveillance',   icon: '👁️', color: 'text-slate-700',  bg: 'bg-slate-50'  },
  'R11': { label: 'R11 — Tests de sécurité réguliers',     icon: '🔬', color: 'text-red-700',    bg: 'bg-red-50'    },
  'R12': { label: 'R12 — Politique de sécurité',           icon: '📋', color: 'text-gray-700',   bg: 'bg-gray-50'   },
}

export const PCI_DSS_CONTROLES: FrameworkControl[] = [
  { ref:'PCI-1.1', type:'TECHNOLOGIQUE',    categorie:'R1',  nom:'Réseau CDE isolé par des contrôles de sécurité',          description:'L\'environnement de données de carte (CDE) est isolé par des pare-feux et routeurs sécurisés configurés selon les bonnes pratiques.' },
  { ref:'PCI-1.2', type:'TECHNOLOGIQUE',    categorie:'R1',  nom:'Segmentation réseau du CDE',                              description:'La segmentation réseau isole le CDE des autres réseaux (DMZ, réseaux invités, OT).' },
  { ref:'PCI-1.3', type:'TECHNOLOGIQUE',    categorie:'R1',  nom:'Règles de pare-feu documentées et révisées',              description:'Les règles de pare-feu sont documentées, justifiées et révisées au moins tous les 6 mois.' },
  { ref:'PCI-2.1', type:'TECHNOLOGIQUE',    categorie:'R2',  nom:'Configuration sécurisée de tous les composants',          description:'Tous les composants systèmes utilisent une configuration sécurisée (CIS Benchmarks ou équivalent).' },
  { ref:'PCI-2.2', type:'TECHNOLOGIQUE',    categorie:'R2',  nom:'Inventaire des composants du CDE',                        description:'Un inventaire précis de tous les composants du CDE est maintenu à jour.' },
  { ref:'PCI-2.3', type:'TECHNOLOGIQUE',    categorie:'R2',  nom:'Désactivation des services et protocoles non nécessaires', description:'Tous les services, protocoles et fonctionnalités inutiles sont désactivés dans le CDE.' },
  { ref:'PCI-3.1', type:'TECHNOLOGIQUE',    categorie:'R3',  nom:'Politique de rétention et suppression des données de carte', description:'La politique de rétention des données de carte est définie et appliquée. Les données inutiles sont supprimées.' },
  { ref:'PCI-3.3', type:'TECHNOLOGIQUE',    categorie:'R3',  nom:'CVV/CVC non stocké après autorisation',                   description:'Les données sensibles d\'authentification (CVV, CVV2, CVC2, CAV2, CID) ne sont jamais stockées après autorisation.' },
  { ref:'PCI-3.4', type:'TECHNOLOGIQUE',    categorie:'R3',  nom:'PAN masqué (4 derniers chiffres visibles au plus)',        description:'Le PAN est masqué lors de l\'affichage (seuls les 4 derniers chiffres sont affichés).' },
  { ref:'PCI-3.5', type:'TECHNOLOGIQUE',    categorie:'R3',  nom:'PAN chiffré avec des clés gérées selon les bonnes pratiques', description:'Le PAN est chiffré par un algorithme fort (AES-256) avec une gestion des clés documentée.' },
  { ref:'PCI-4.1', type:'TECHNOLOGIQUE',    categorie:'R4',  nom:'TLS 1.2 minimum sur tous les flux transmettant des données de carte', description:'TLS 1.2 (recommandé : TLS 1.3) est utilisé pour toutes les transmissions de données de carte sur des réseaux ouverts.' },
  { ref:'PCI-4.2', type:'TECHNOLOGIQUE',    categorie:'R4',  nom:'Inventaire des certificats TLS',                          description:'Un inventaire des certificats TLS couvrant les flux de données de carte est maintenu et surveillé.' },
  { ref:'PCI-5.1', type:'TECHNOLOGIQUE',    categorie:'R5',  nom:'Solution anti-malware déployée sur tous les composants',  description:'Une solution anti-malware est déployée et maintenue à jour sur tous les composants du CDE.' },
  { ref:'PCI-5.3', type:'TECHNOLOGIQUE',    categorie:'R5',  nom:'Mécanismes anti-phishing et anti-hameçonnage',            description:'Des mécanismes de protection contre le phishing et l\'ingénierie sociale sont mis en œuvre.' },
  { ref:'PCI-6.1', type:'ORGANISATIONNELLE', categorie:'R6', nom:'Processus de gestion des vulnérabilités applicatives',    description:'Un processus d\'identification et de correction des vulnérabilités applicatives est établi et documenté.' },
  { ref:'PCI-6.2', type:'TECHNOLOGIQUE',    categorie:'R6',  nom:'Logiciels sécurisés dès la conception (Security by Design)', description:'Les logiciels sont développés et maintenus de manière sécurisée (OWASP Top 10, revues de code, SAST/DAST).' },
  { ref:'PCI-6.3', type:'TECHNOLOGIQUE',    categorie:'R6',  nom:'Vulnérabilités de sécurité identifiées et traitées',      description:'Les vulnérabilités de sécurité des logiciels sont identifiées via CVE/NVD et traitées selon leur criticité.' },
  { ref:'PCI-6.4', type:'TECHNOLOGIQUE',    categorie:'R6',  nom:'Applications web protégées par un WAF',                  description:'Les applications web exposées au trafic Internet sont protégées par un WAF ou un processus de revue de code.' },
  { ref:'PCI-7.1', type:'ORGANISATIONNELLE', categorie:'R7', nom:'Accès aux composants du CDE limités selon le besoin',     description:'L\'accès aux composants du CDE est limité aux personnes ayant un besoin légitime documenté.' },
  { ref:'PCI-7.2', type:'TECHNOLOGIQUE',    categorie:'R7',  nom:'Système de contrôle d\'accès basé sur les rôles (RBAC)',  description:'Un système de contrôle d\'accès (RBAC ou DAC) est mis en œuvre pour tous les composants du CDE.' },
  { ref:'PCI-8.1', type:'TECHNOLOGIQUE',    categorie:'R8',  nom:'Politique d\'identification et d\'authentification',     description:'Une politique d\'identification et d\'authentification est définie pour tous les utilisateurs du CDE.' },
  { ref:'PCI-8.3', type:'TECHNOLOGIQUE',    categorie:'R8',  nom:'MFA requise pour tous les accès au CDE',                 description:'L\'authentification multi-facteurs est requise pour tous les accès distants et individuels aux composants du CDE.' },
  { ref:'PCI-8.6', type:'TECHNOLOGIQUE',    categorie:'R8',  nom:'Mots de passe conformes aux exigences PCI-DSS',          description:'Les mots de passe sont d\'au moins 12 caractères avec complexité et changement tous les 90 jours.' },
  { ref:'PCI-9.1', type:'PHYSIQUE',         categorie:'R9',  nom:'Contrôles d\'accès physiques aux zones sensibles',       description:'L\'accès physique aux zones contenant les données de carte ou les composants du CDE est restreint et contrôlé.' },
  { ref:'PCI-9.4', type:'PHYSIQUE',         categorie:'R9',  nom:'Protection des médias physiques',                         description:'Les médias physiques contenant des données de carte sont sécurisés, classifiés et détruits de façon sécurisée.' },
  { ref:'PCI-10.1', type:'TECHNOLOGIQUE',   categorie:'R10', nom:'Journalisation de toutes les activités du CDE',           description:'Tous les accès aux composants du CDE et aux données de carte sont journalisés.' },
  { ref:'PCI-10.2', type:'TECHNOLOGIQUE',   categorie:'R10', nom:'Piste d\'audit complète sur les événements critiques',    description:'Des journaux d\'audit sont générés pour tous les événements critiques (accès root, échecs d\'auth, modifications des journaux).' },
  { ref:'PCI-10.5', type:'TECHNOLOGIQUE',   categorie:'R10', nom:'Conservation des journaux ≥ 12 mois',                    description:'Les journaux d\'audit sont conservés au moins 12 mois (3 mois en ligne immédiatement disponibles).' },
  { ref:'PCI-11.3', type:'TECHNOLOGIQUE',   categorie:'R11', nom:'Tests de pénétration externes et internes',              description:'Des tests de pénétration sont réalisés au moins une fois par an et après tout changement majeur de l\'infrastructure.' },
  { ref:'PCI-11.4', type:'TECHNOLOGIQUE',   categorie:'R11', nom:'Détection des points d\'accès sans fil non autorisés',   description:'Des scans trimestriels détectent les points d\'accès Wi-Fi non autorisés dans le CDE.' },
  { ref:'PCI-12.1', type:'ORGANISATIONNELLE', categorie:'R12', nom:'Politique de sécurité des informations PCI',           description:'Une politique de sécurité des informations couvrant tous les composants PCI-DSS est établie et maintenue.' },
  { ref:'PCI-12.3', type:'ORGANISATIONNELLE', categorie:'R12', nom:'Évaluation des risques de sécurité formelle',          description:'Une évaluation des risques de sécurité est réalisée au moins une fois par an et après chaque changement majeur.' },
  { ref:'PCI-12.10', type:'ORGANISATIONNELLE', categorie:'R12', nom:'Plan de réponse aux incidents PCI',                   description:'Un plan de réponse aux incidents couvrant les violations de données de carte est défini et testé annuellement.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// NIST SP 800-53 Rev 5 — Contrôles clés par famille
// Source : NIST Special Publication 800-53 Rev 5 (2020)
// ─────────────────────────────────────────────────────────────────────────────

export const NIST_800_53_CATEGORIES: Record<string, FrameworkCategory> = {
  AC:  { label: 'AC — Contrôle des accès',                    icon: '🔑', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  AT:  { label: 'AT — Sensibilisation et formation',          icon: '👥', color: 'text-green-700',  bg: 'bg-green-50'  },
  AU:  { label: 'AU — Audit et redevabilité',                 icon: '📋', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  CA:  { label: 'CA — Évaluation, autorisation, surveillance', icon: '📊', color: 'text-purple-700', bg: 'bg-purple-50' },
  CM:  { label: 'CM — Gestion de la configuration',           icon: '⚙️', color: 'text-teal-700',   bg: 'bg-teal-50'   },
  CP:  { label: 'CP — Planification de la continuité',        icon: '🔄', color: 'text-cyan-700',   bg: 'bg-cyan-50'   },
  IA:  { label: 'IA — Identification et authentification',    icon: '👤', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  IR:  { label: 'IR — Réponse aux incidents',                 icon: '🚨', color: 'text-orange-700', bg: 'bg-orange-50' },
  MA:  { label: 'MA — Maintenance',                          icon: '🔧', color: 'text-gray-700',   bg: 'bg-gray-50'   },
  MP:  { label: 'MP — Protection des médias',                 icon: '💾', color: 'text-rose-700',   bg: 'bg-rose-50'   },
  PE:  { label: 'PE — Protection physique et environnementale', icon: '🏢', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  PL:  { label: 'PL — Planification',                        icon: '📝', color: 'text-slate-700',  bg: 'bg-slate-50'  },
  RA:  { label: 'RA — Évaluation des risques',                icon: '🎯', color: 'text-red-700',    bg: 'bg-red-50'    },
  SA:  { label: 'SA — Acquisition de systèmes et services',   icon: '🛒', color: 'text-lime-700',   bg: 'bg-lime-50'   },
  SC:  { label: 'SC — Protection des systèmes et communications', icon: '🌐', color: 'text-violet-700', bg: 'bg-violet-50' },
  SI:  { label: 'SI — Intégrité des systèmes et informations', icon: '🔒', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  SR:  { label: 'SR — Gestion des risques chaîne d\'approvisionnement', icon: '🔗', color: 'text-fuchsia-700', bg: 'bg-fuchsia-50' },
}

export const NIST_800_53_CONTROLES: FrameworkControl[] = [
  // AC — Access Control
  { ref:'AC-1',  type:'ORGANISATIONNELLE', categorie:'AC', nom:'Politique et procédures de contrôle des accès',         description:'Développer, documenter et diffuser une politique de contrôle des accès et des procédures associées.' },
  { ref:'AC-2',  type:'TECHNOLOGIQUE',    categorie:'AC', nom:'Gestion des comptes',                                    description:'Gérer les comptes du système : création, activation, modification, révision, désactivation et suppression.' },
  { ref:'AC-3',  type:'TECHNOLOGIQUE',    categorie:'AC', nom:'Application de l\'accès autorisé',                       description:'Appliquer les autorisations d\'accès approuvées conformément à la politique de contrôle des accès.' },
  { ref:'AC-5',  type:'ORGANISATIONNELLE', categorie:'AC', nom:'Séparation des tâches',                                 description:'Séparer les tâches des individus pour réduire le risque d\'activité malveillante non détectée.' },
  { ref:'AC-6',  type:'TECHNOLOGIQUE',    categorie:'AC', nom:'Principe du moindre privilège',                          description:'N\'employer que le niveau de privilège minimal requis pour accomplir les tâches assignées.' },
  { ref:'AC-17', type:'TECHNOLOGIQUE',    categorie:'AC', nom:'Accès à distance',                                       description:'Établir et documenter les exigences d\'utilisation, les restrictions et les configurations des accès distants.' },
  { ref:'AC-18', type:'TECHNOLOGIQUE',    categorie:'AC', nom:'Utilisation des réseaux sans fil',                       description:'Établir des exigences d\'utilisation, des restrictions et des directives de configuration pour les réseaux sans fil.' },
  { ref:'AC-19', type:'TECHNOLOGIQUE',    categorie:'AC', nom:'Contrôle des appareils mobiles',                         description:'Établir des exigences de configuration pour les appareils mobiles. Autoriser la connexion au système.' },
  // AT — Awareness and Training
  { ref:'AT-1',  type:'ORGANISATIONNELLE', categorie:'AT', nom:'Politique et procédures de sensibilisation',           description:'Développer et documenter une politique et des procédures de sensibilisation à la sécurité.' },
  { ref:'AT-2',  type:'HUMAINE',          categorie:'AT', nom:'Sensibilisation à la sécurité',                          description:'Fournir une formation de base de sensibilisation à la sécurité (à l\'intégration puis annuellement).' },
  { ref:'AT-3',  type:'HUMAINE',          categorie:'AT', nom:'Formation à la sécurité basée sur les rôles',            description:'Fournir une formation de sécurité spécifique au rôle avant d\'accorder les accès, puis annuellement.' },
  { ref:'AT-4',  type:'ORGANISATIONNELLE', categorie:'AT', nom:'Enregistrement des formations de sécurité',             description:'Documenter et surveiller les activités individuelles de sensibilisation et de formation à la sécurité.' },
  // AU — Audit and Accountability
  { ref:'AU-2',  type:'TECHNOLOGIQUE',    categorie:'AU', nom:'Événements journalisés',                                 description:'Identifier les types d\'événements à journaliser pour détecter, enquêter et analyser les incidents.' },
  { ref:'AU-3',  type:'TECHNOLOGIQUE',    categorie:'AU', nom:'Contenu des enregistrements d\'audit',                   description:'Générer des enregistrements d\'audit contenant : date/heure, composant, utilisateur, résultat, etc.' },
  { ref:'AU-6',  type:'TECHNOLOGIQUE',    categorie:'AU', nom:'Révision, analyse et reporting des audits',              description:'Réviser et analyser régulièrement les enregistrements d\'audit pour détecter les activités anormales.' },
  { ref:'AU-9',  type:'TECHNOLOGIQUE',    categorie:'AU', nom:'Protection des informations d\'audit',                   description:'Protéger les informations d\'audit contre l\'accès, la modification et la suppression non autorisés.' },
  { ref:'AU-11', type:'TECHNOLOGIQUE',    categorie:'AU', nom:'Rétention des enregistrements d\'audit',                 description:'Conserver les enregistrements d\'audit pendant la durée requise par la politique.' },
  // CA — Assessment, Authorization, and Monitoring
  { ref:'CA-2',  type:'ORGANISATIONNELLE', categorie:'CA', nom:'Évaluations de contrôle',                              description:'Évaluer l\'efficacité des contrôles de sécurité et de protection de la vie privée du système.' },
  { ref:'CA-3',  type:'ORGANISATIONNELLE', categorie:'CA', nom:'Échanges d\'informations et accord',                    description:'Approuver et documenter les connexions entre systèmes via des accords d\'échange d\'informations.' },
  { ref:'CA-7',  type:'TECHNOLOGIQUE',    categorie:'CA', nom:'Surveillance continue',                                  description:'Développer un programme de surveillance continue et évaluer les contrôles en continu.' },
  // CM — Configuration Management
  { ref:'CM-2',  type:'TECHNOLOGIQUE',    categorie:'CM', nom:'Configuration de référence (baseline)',                  description:'Développer, documenter et maintenir une configuration de référence sécurisée pour le système.' },
  { ref:'CM-6',  type:'TECHNOLOGIQUE',    categorie:'CM', nom:'Paramètres de configuration',                            description:'Établir et documenter les paramètres de configuration pour la technologie employée dans le système.' },
  { ref:'CM-7',  type:'TECHNOLOGIQUE',    categorie:'CM', nom:'Fonctionnalité minimale',                                description:'Configurer le système pour ne fournir que les fonctionnalités essentielles. Interdire les composants inutiles.' },
  { ref:'CM-8',  type:'TECHNOLOGIQUE',    categorie:'CM', nom:'Inventaire des composants du système',                   description:'Développer et documenter un inventaire des composants du système, maintenu à jour.' },
  // CP — Contingency Planning
  { ref:'CP-2',  type:'ORGANISATIONNELLE', categorie:'CP', nom:'Plan de continuité',                                    description:'Développer un plan de continuité pour le système incluant les objectifs de récupération (RTO/RPO).' },
  { ref:'CP-4',  type:'ORGANISATIONNELLE', categorie:'CP', nom:'Tests du plan de continuité',                           description:'Tester le plan de continuité pour déterminer son efficacité et préparer les réponses réelles.' },
  { ref:'CP-9',  type:'TECHNOLOGIQUE',    categorie:'CP', nom:'Sauvegarde du système',                                  description:'Effectuer des sauvegardes des informations et des logiciels système à la fréquence définie.' },
  { ref:'CP-10', type:'TECHNOLOGIQUE',    categorie:'CP', nom:'Récupération et reconstitution du système',              description:'Restaurer le système vers un état connu après une panne, compromission ou défaillance.' },
  // IA — Identification and Authentication
  { ref:'IA-2',  type:'TECHNOLOGIQUE',    categorie:'IA', nom:'Identification et authentification (utilisateurs organisationnels)', description:'Identifier et authentifier de manière unique les utilisateurs organisationnels. MFA requis pour accès privilégiés.' },
  { ref:'IA-4',  type:'ORGANISATIONNELLE', categorie:'IA', nom:'Gestion des identifiants',                              description:'Gérer le cycle de vie des identifiants : autorisation, désactivation et réutilisation.' },
  { ref:'IA-5',  type:'TECHNOLOGIQUE',    categorie:'IA', nom:'Gestion des authentifiants',                             description:'Gérer les authentifiants (mots de passe, clés, certificats, jetons) avec des exigences de force et de rotation.' },
  { ref:'IA-8',  type:'TECHNOLOGIQUE',    categorie:'IA', nom:'Identification et authentification (utilisateurs non organisationnels)', description:'Identifier et authentifier les utilisateurs non organisationnels (partenaires, fournisseurs, public).' },
  // IR — Incident Response
  { ref:'IR-4',  type:'ORGANISATIONNELLE', categorie:'IR', nom:'Gestion des incidents',                                 description:'Mettre en œuvre une capacité de gestion des incidents comprenant préparation, détection, analyse et récupération.' },
  { ref:'IR-5',  type:'ORGANISATIONNELLE', categorie:'IR', nom:'Suivi des incidents',                                   description:'Suivre et documenter les incidents de sécurité.' },
  { ref:'IR-6',  type:'ORGANISATIONNELLE', categorie:'IR', nom:'Signalement des incidents',                             description:'Signaler les incidents de sécurité à l\'autorité compétente dans les délais requis.' },
  { ref:'IR-8',  type:'ORGANISATIONNELLE', categorie:'IR', nom:'Plan de réponse aux incidents',                         description:'Développer un plan de réponse aux incidents couvrant les rôles, les responsabilités et les communications.' },
  // MA — Maintenance
  { ref:'MA-2',  type:'ORGANISATIONNELLE', categorie:'MA', nom:'Maintenance contrôlée',                                 description:'Planifier, effectuer, documenter et réviser les activités de maintenance des composants système.' },
  { ref:'MA-5',  type:'ORGANISATIONNELLE', categorie:'MA', nom:'Personnel de maintenance',                              description:'Établir un processus pour autoriser et gérer les personnels de maintenance (internes et externes).' },
  // MP — Media Protection
  { ref:'MP-2',  type:'ORGANISATIONNELLE', categorie:'MP', nom:'Accès aux médias',                                      description:'Restreindre l\'accès aux médias système contenant des informations sensibles aux utilisateurs autorisés.' },
  { ref:'MP-6',  type:'TECHNOLOGIQUE',    categorie:'MP', nom:'Nettoyage des médias',                                   description:'Nettoyer les médias système avant cession, réutilisation ou destruction selon les politiques requises.' },
  { ref:'MP-7',  type:'ORGANISATIONNELLE', categorie:'MP', nom:'Utilisation des médias',                                description:'Restreindre l\'utilisation des types de médias sur les composants du système.' },
  // PE — Physical and Environmental Protection
  { ref:'PE-2',  type:'PHYSIQUE',         categorie:'PE', nom:'Autorisations d\'accès physique',                        description:'Développer, approuver et maintenir une liste de personnes autorisées à accéder aux sites.' },
  { ref:'PE-3',  type:'PHYSIQUE',         categorie:'PE', nom:'Contrôle des accès physiques',                           description:'Mettre en œuvre des mesures de sécurité physiques pour contrôler l\'accès aux zones contenant le système.' },
  { ref:'PE-6',  type:'PHYSIQUE',         categorie:'PE', nom:'Surveillance de l\'accès physique',                      description:'Surveiller les accès physiques pour détecter et répondre aux incidents de sécurité physique.' },
  // PL — Planning
  { ref:'PL-2',  type:'ORGANISATIONNELLE', categorie:'PL', nom:'Plan de sécurité et confidentialité du système',        description:'Développer, documenter et mettre en œuvre un plan de sécurité et de confidentialité du système.' },
  { ref:'PL-8',  type:'ORGANISATIONNELLE', categorie:'PL', nom:'Architecture de sécurité et confidentialité',           description:'Développer une architecture de sécurité couvrant les protections et leur relation avec l\'architecture globale.' },
  // RA — Risk Assessment
  { ref:'RA-3',  type:'ORGANISATIONNELLE', categorie:'RA', nom:'Évaluation des risques',                                description:'Évaluer le risque lié aux opérations, actifs et individus de l\'organisation.' },
  { ref:'RA-5',  type:'TECHNOLOGIQUE',    categorie:'RA', nom:'Surveillance des vulnérabilités',                        description:'Scanner les vulnérabilités du système à la fréquence définie et mettre à jour les outils de scan.' },
  // SA — System and Services Acquisition
  { ref:'SA-8',  type:'ORGANISATIONNELLE', categorie:'SA', nom:'Principes de sécurité et confidentialité dès la conception', description:'Appliquer des principes d\'ingénierie de sécurité et de confidentialité dans la spécification et la conception.' },
  { ref:'SA-11', type:'TECHNOLOGIQUE',    categorie:'SA', nom:'Tests et évaluation du développement',                  description:'Effectuer des tests de sécurité du code développé selon les exigences de certification.' },
  // SC — System and Communications Protection
  { ref:'SC-5',  type:'TECHNOLOGIQUE',    categorie:'SC', nom:'Protection contre les dénis de service',                 description:'Mettre en œuvre des protections contre les attaques par déni de service (DoS/DDoS).' },
  { ref:'SC-7',  type:'TECHNOLOGIQUE',    categorie:'SC', nom:'Protection de frontière réseau',                         description:'Surveiller et contrôler les communications aux frontières externes et internes clés du système.' },
  { ref:'SC-8',  type:'TECHNOLOGIQUE',    categorie:'SC', nom:'Confidentialité et intégrité des transmissions',         description:'Protéger la confidentialité et l\'intégrité des informations transmises (TLS, VPN, chiffrement).' },
  { ref:'SC-28', type:'TECHNOLOGIQUE',    categorie:'SC', nom:'Protection des informations au repos',                   description:'Protéger la confidentialité et l\'intégrité des informations au repos (chiffrement disque, BDD).' },
  // SI — System and Information Integrity
  { ref:'SI-2',  type:'TECHNOLOGIQUE',    categorie:'SI', nom:'Correction des défauts (patch management)',              description:'Identifier, signaler et corriger les défauts des systèmes d\'information dans les délais définis.' },
  { ref:'SI-3',  type:'TECHNOLOGIQUE',    categorie:'SI', nom:'Protection contre les codes malveillants',               description:'Mettre en œuvre des protections contre les codes malveillants aux points d\'entrée et de sortie du système.' },
  { ref:'SI-4',  type:'TECHNOLOGIQUE',    categorie:'SI', nom:'Surveillance du système',                                description:'Surveiller le système pour détecter les attaques, les indicateurs de compromission et les anomalies.' },
  { ref:'SI-7',  type:'TECHNOLOGIQUE',    categorie:'SI', nom:'Intégrité des logiciels, firmwares et informations',     description:'Employer des mécanismes d\'intégrité pour détecter les modifications non autorisées des logiciels et des informations.' },
  // SR — Supply Chain Risk Management
  { ref:'SR-1',  type:'ORGANISATIONNELLE', categorie:'SR', nom:'Politique de gestion des risques chaîne d\'approvisionnement', description:'Développer, documenter et diffuser une politique de gestion des risques de la chaîne d\'approvisionnement.' },
  { ref:'SR-3',  type:'ORGANISATIONNELLE', categorie:'SR', nom:'Contrôles de la chaîne d\'approvisionnement',           description:'Établir un plan et des contrôles pour gérer les risques associés à la chaîne d\'approvisionnement.' },
  { ref:'SR-6',  type:'ORGANISATIONNELLE', categorie:'SR', nom:'Évaluation des fournisseurs et révision des performances', description:'Évaluer les pratiques des fournisseurs selon la politique de gestion des risques supply chain.' },
]

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
  if (has('administration', 'public', 'collectivit', 'état', 'etat', 'government')) return ['ANSSI_HYG', 'ISO27001']
  if (has('énergie', 'energie', 'utilities', 'eau', 'nucléaire', 'nucleaire', 'energy')) return ['IEC_62443', 'ANSSI_HYG', 'ISO27001']
  if (has('télécom', 'telecom', 'communication')) return ['ANSSI_HYG', 'NIST_CSF', 'ISO27001']
  if (has('transport', 'logistique', 'aérien', 'aerien', 'ferroviaire', 'logistics')) return ['IEC_62443', 'ANSSI_HYG', 'ISO27001']
  if (has('e-commerce', 'ecommerce', 'marketplace')) return ['PCI_DSS', 'ISO27001', 'SOC2', 'NIST_SSDF']
  if (has('commerce', 'distribution', 'retail', 'paiement', 'payment')) return ['PCI_DSS', 'ISO27001']
  if (has('industrie', 'manufactur', 'usine', 'scada', 'industry')) return ['IEC_62443', 'CIS_V8', 'ISO27001']
  if (has('informatique', 'numérique', 'numerique', 'logiciel', 'saas', 'cloud', 'tech', 'digital')) return ['ISO27001', 'SOC2', 'NIST_SSDF', 'NIST_CSF', 'CIS_V8']
  if (has('éducation', 'education', 'recherche', 'université', 'universite', 'research')) return ['ISO27001', 'ANSSI_HYG']
  if (has('juridique', 'avocat', 'notaire', 'juriste', 'barreau', 'legal', 'law firm')) return ['ANSSI_HYG', 'ISO27001']
  if (has('agricol', 'agro', 'agriculture', 'élevage', 'elevage', 'farming', 'agri-food')) return ['ANSSI_HYG', 'ISO27001']
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
  else if (/(process|scada|nucleaire|nuclear|\bot\b)/.test(s)) priority = ['IEC_62443']
  if (priority.length === 0) return base
  return [...new Set([...priority, ...base])]
}

/**
 * Référentiels recommandés selon le secteur, la taille de l'organisation ET le
 * sous-secteur (le 1er = prioritaire). CUSTOM exclu. Guide le choix sans l'imposer.
 */
export function recommendedFrameworksForSector(secteur?: string | null, taille?: TailleAnalyse | null, sousSecteur?: string | null): FrameworkId[] {
  const base = refineFrameworksBySousSecteur(baseFrameworksForSector(secteur), sousSecteur)
  return adaptFrameworksForSize(base, taille)
}
