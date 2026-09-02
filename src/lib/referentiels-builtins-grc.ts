// ─── Référentiels GRC livrés (non-cyber) — catalogue canonique ───────────────
// Cadres RÉGLEMENTAIRES au-delà du cyber, livrés en code (une version canonique,
// sélectionnable par l'organisation) : LCB-FT, gel des avoirs, RGPD, DSP2, Sapin II,
// contrôle interne comptable, octroi de crédit, externalisation, contrôle interne.
//
// Chaque référentiel expose une OSSATURE d'exigences de départ (points de contrôle
// de haut niveau) que l'organisation rattache à ses propres contrôles/audits et
// enrichit au besoin (§3 de docs/referentiels-univers-grc.md). Contenu FR (produit
// bancaire français) ; la localisation des exigences non-cyber viendra plus tard.
//
// Exposés par referentiel.server.ts au MÊME titre que les cadres cyber (source
// BUILTIN), keyés par `code` → contrôles, audit et conformité s'y rattachent sans
// distinction. Logique PURE et testée.

import type { Exigence } from './referentiel'
import { coerceDomaine, type Domaine } from './referentiel-domaines'

export interface GrcBuiltinReferentiel {
  code: string
  nom: string
  domaine: Domaine
  /** Nature affichée (REGLEMENTATION | NORME | POLITIQUE…). */
  nature: string
  version: string
  description: string
  exigences: Exigence[]
}

// Toutes les exigences GRC non-cyber sont, par défaut, de nature ORGANISATIONNELLE
// (les 4 catégories ControlType sont cyber-ISO ; la `categorie` porte le vrai
// regroupement métier : « Vigilance », « Filtrage », « Piste d'audit »…).
const O = 'ORGANISATIONNELLE' as const
const ex = (ref: string, nom: string, categorie: string, description: string): Exigence =>
  ({ ref, nom, categorie, description, type: O })

export const GRC_BUILTINS: GrcBuiltinReferentiel[] = [
  {
    code: 'RGPD', nom: 'RGPD', domaine: 'PROTECTION_DONNEES', nature: 'REGLEMENTATION',
    version: 'UE 2016/679',
    description: 'Règlement général sur la protection des données — traitement des données personnelles.',
    exigences: [
      ex('RGPD-30', 'Registre des traitements', 'Gouvernance', 'Tenir et mettre à jour le registre des activités de traitement (art. 30).'),
      ex('RGPD-6', 'Licéité & base légale', 'Fondement', 'Chaque traitement repose sur une base légale valide ; consentement recueilli et traçable si requis (art. 6-7).'),
      ex('RGPD-13', 'Information des personnes', 'Transparence', 'Informer les personnes concernées (mentions, finalités, durées) (art. 13-14).'),
      ex('RGPD-15', 'Droits des personnes', 'Droits', 'Traiter les demandes d’accès, rectification, effacement, opposition dans les délais (art. 15-22).'),
      ex('RGPD-32', 'Sécurité des traitements', 'Sécurité', 'Mesures techniques et organisationnelles adaptées au risque (art. 32).'),
      ex('RGPD-33', 'Violations de données', 'Incident', 'Notifier la CNIL sous 72 h et, si nécessaire, les personnes concernées (art. 33-34).'),
      ex('RGPD-35', 'Analyse d’impact (AIPD)', 'Risque', 'Réaliser une AIPD pour les traitements à risque élevé (art. 35).'),
      ex('RGPD-28', 'Sous-traitants', 'Tiers', 'Encadrer les sous-traitants par contrat et garanties suffisantes (art. 28).'),
    ],
  },
  {
    code: 'LCB_FT', nom: 'Dispositif LCB-FT', domaine: 'LCB_FT', nature: 'REGLEMENTATION',
    version: 'CMF art. L.561-1 s.',
    description: 'Lutte contre le blanchiment de capitaux et le financement du terrorisme.',
    exigences: [
      ex('LCBFT-1', 'Classification des risques', 'Approche par les risques', 'Établir et actualiser la classification des risques BC-FT (activités, clientèle, produits, canaux, géographie).'),
      ex('LCBFT-2', 'Entrée en relation / KYC', 'Vigilance', 'Identifier et vérifier l’identité du client et du bénéficiaire effectif avant l’entrée en relation.'),
      ex('LCBFT-3', 'Vigilance constante', 'Vigilance', 'Exercer une vigilance continue sur les opérations et actualiser la connaissance client.'),
      ex('LCBFT-4', 'Personnes politiquement exposées', 'Vigilance renforcée', 'Détecter les PPE et appliquer des mesures de vigilance renforcée.'),
      ex('LCBFT-5', 'Déclaration de soupçon', 'Déclaration', 'Détecter, analyser et déclarer à Tracfin les opérations suspectes sans délai.'),
      ex('LCBFT-6', 'Conservation des documents', 'Traçabilité', 'Conserver les documents et pièces pendant la durée réglementaire (5 ans).'),
      ex('LCBFT-7', 'Formation & sensibilisation', 'Dispositif', 'Former régulièrement les personnels exposés au risque BC-FT.'),
      ex('LCBFT-8', 'Organisation & responsable', 'Gouvernance', 'Désigner un responsable LCB-FT et un déclarant/correspondant Tracfin ; procédures internes formalisées.'),
    ],
  },
  {
    code: 'SANCTIONS_GEL', nom: 'Gel des avoirs & sanctions', domaine: 'SANCTIONS_GEL', nature: 'REGLEMENTATION',
    version: 'Règl. UE + DG Trésor',
    description: 'Mesures restrictives et gel des avoirs (UE/ONU/OFAC, Direction générale du Trésor).',
    exigences: [
      ex('GEL-1', 'Filtrage des listes', 'Filtrage', 'Filtrer la base clients contre les listes de sanctions (UE, ONU, OFAC) et à chaque mise à jour.'),
      ex('GEL-2', 'Filtrage des transactions', 'Filtrage', 'Filtrer les opérations (virements, correspondants) contre les mesures restrictives.'),
      ex('GEL-3', 'Traitement des alertes', 'Analyse', 'Analyser et lever/qualifier les correspondances dans des délais maîtrisés.'),
      ex('GEL-4', 'Gel sans délai', 'Exécution', 'Mettre en œuvre le gel des fonds sans délai en cas de correspondance avérée.'),
      ex('GEL-5', 'Déclaration DG Trésor', 'Déclaration', 'Déclarer les mesures de gel à la Direction générale du Trésor.'),
    ],
  },
  {
    code: 'DSP2', nom: 'DSP2 — services de paiement', domaine: 'PROTECTION_CLIENTELE', nature: 'REGLEMENTATION',
    version: 'Dir. UE 2015/2366',
    description: 'Deuxième directive sur les services de paiement (sécurité et protection du payeur).',
    exigences: [
      ex('DSP2-1', 'Authentification forte (SCA)', 'Sécurité', 'Appliquer l’authentification forte du client et gérer les exemptions conformément aux RTS.'),
      ex('DSP2-2', 'Sécurité des paiements', 'Sécurité', 'Mesures de sécurité et de surveillance des transactions (RTS).'),
      ex('DSP2-3', 'Accès aux comptes (TPP)', 'Ouverture', 'Encadrer l’accès des prestataires tiers (AISP/PISP) via interfaces sécurisées.'),
      ex('DSP2-4', 'Incidents de paiement majeurs', 'Incident', 'Détecter et notifier les incidents opérationnels/sécurité majeurs.'),
      ex('DSP2-5', 'Information & transparence', 'Client', 'Informer le payeur (frais, délais, droits) et gérer les contestations.'),
    ],
  },
  {
    code: 'SAPIN2', nom: 'Anticorruption (Sapin II)', domaine: 'DEONTOLOGIE', nature: 'REGLEMENTATION',
    version: 'Loi 2016-1691',
    description: 'Dispositif anticorruption — les 8 piliers de l’article 17.',
    exigences: [
      ex('SAPIN2-1', 'Code de conduite', 'Cadre', 'Code de conduite anticorruption intégré au règlement intérieur.'),
      ex('SAPIN2-2', 'Dispositif d’alerte', 'Alerte', 'Dispositif d’alerte interne pour le recueil des signalements.'),
      ex('SAPIN2-3', 'Cartographie des risques', 'Risque', 'Cartographie des risques de corruption, actualisée.'),
      ex('SAPIN2-4', 'Évaluation des tiers', 'Tiers', 'Procédures d’évaluation des clients, fournisseurs et intermédiaires.'),
      ex('SAPIN2-5', 'Contrôles comptables', 'Comptable', 'Contrôles comptables destinés à prévenir la dissimulation de faits de corruption.'),
      ex('SAPIN2-6', 'Formation', 'Dispositif', 'Formation des cadres et personnels exposés.'),
      ex('SAPIN2-7', 'Régime disciplinaire', 'Sanction', 'Régime disciplinaire sanctionnant les manquements.'),
      ex('SAPIN2-8', 'Contrôle & évaluation', 'Pilotage', 'Contrôle interne et évaluation de l’efficacité du dispositif.'),
    ],
  },
  {
    code: 'COMPTA_CI', nom: 'Contrôle interne comptable', domaine: 'COMPTABLE_FINANCIER', nature: 'REGLEMENTATION',
    version: 'Arrêté 3 nov. 2014 (mod. 2021)',
    description: 'Fiabilité de l’information comptable et financière (contrôle interne comptable).',
    exigences: [
      ex('COMPTA-1', 'Piste d’audit fiable', 'Traçabilité', 'Chemin de révision permettant de reconstituer toute écriture jusqu’à sa pièce justificative.'),
      ex('COMPTA-2', 'Séparation des tâches', 'Organisation', 'Séparation des fonctions d’engagement, d’enregistrement et de règlement.'),
      ex('COMPTA-3', 'Justification des comptes', 'Contrôle', 'Rapprochements et justification périodique des soldes de comptes.'),
      ex('COMPTA-4', 'Contrôles d’arrêté', 'Arrêté', 'Contrôles de niveau 1 et 2 sur les arrêtés comptables.'),
      ex('COMPTA-5', 'Archivage', 'Conservation', 'Archivage et intégrité des pièces et de la documentation comptable.'),
    ],
  },
  {
    code: 'CREDIT_OCTROI', nom: 'Octroi & suivi des crédits', domaine: 'CREDIT_CONTREPARTIE', nature: 'REGLEMENTATION',
    version: 'EBA/GL/2020/06',
    description: 'Octroi et suivi des prêts (procédures d’octroi, garanties, suivi).',
    exigences: [
      ex('CRED-1', 'Capacité de remboursement', 'Analyse', 'Analyse de solvabilité et de la capacité de remboursement de l’emprunteur.'),
      ex('CRED-2', 'Délégations d’octroi', 'Gouvernance', 'Respect des schémas de délégation et des limites d’octroi.'),
      ex('CRED-3', 'Dossier & garanties', 'Constitution', 'Complétude du dossier, évaluation et formalisation des garanties.'),
      ex('CRED-4', 'Comité des engagements', 'Décision', 'Passage en comité des engagements pour les dossiers au-delà des seuils.'),
      ex('CRED-5', 'Revue & impayés', 'Suivi', 'Revue périodique des encours et détection précoce des impayés.'),
    ],
  },
  {
    code: 'EXTERNALISATION', nom: 'Externalisation & prestataires', domaine: 'RISQUE_OPERATIONNEL', nature: 'REGLEMENTATION',
    version: 'EBA/GL/2019/02 + DORA art. 28',
    description: 'Encadrement des prestations externalisées et des prestataires critiques.',
    exigences: [
      ex('EXT-1', 'Registre des externalisations', 'Cartographie', 'Registre à jour des accords d’externalisation, dont les fonctions critiques.'),
      ex('EXT-2', 'Criticité & due diligence', 'Évaluation', 'Analyse de criticité et diligence préalable avant externalisation.'),
      ex('EXT-3', 'Clauses contractuelles', 'Contrat', 'Droits d’audit, sous-traitance, sécurité, réversibilité dans les contrats.'),
      ex('EXT-4', 'Suivi des niveaux de service', 'Suivi', 'Suivi des SLA et de la performance des prestataires.'),
      ex('EXT-5', 'Stratégie de sortie', 'Réversibilité', 'Plans de sortie/réversibilité pour les prestations critiques.'),
    ],
  },
  {
    code: 'CONTROLE_INTERNE', nom: 'Dispositif de contrôle interne', domaine: 'GOUVERNANCE_CONTROLE', nature: 'REGLEMENTATION',
    version: 'Arrêté 3 nov. 2014 (mod. 2021)',
    description: 'Gouvernance et dispositif de contrôle interne (permanent et périodique).',
    exigences: [
      ex('CI-1', 'Contrôle permanent', 'Dispositif', 'Contrôles de 1er et 2e niveau formalisés et tracés.'),
      ex('CI-2', 'Contrôle périodique', 'Audit', 'Contrôle périodique indépendant (3e ligne) et plan pluriannuel.'),
      ex('CI-3', 'Gouvernance', 'Gouvernance', 'Rôles de l’organe de surveillance et des dirigeants effectifs.'),
      ex('CI-4', 'Reporting de contrôle interne', 'Reporting', 'Rapport annuel de contrôle interne et informations à l’organe de surveillance.'),
      ex('CI-5', 'Cartographie des risques', 'Risque', 'Cartographie des risques tenue à jour, alimentant le plan de contrôle.'),
    ],
  },
]

export const GRC_BUILTIN_CODES: string[] = GRC_BUILTINS.map(r => r.code)

const BY_CODE: Record<string, GrcBuiltinReferentiel> = Object.fromEntries(GRC_BUILTINS.map(r => [r.code, r]))

/** Vrai si `code` est un référentiel GRC livré. */
export function isGrcBuiltin(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(BY_CODE, code)
}

/** Référentiel GRC livré par code, ou undefined. */
export function grcBuiltinByCode(code: string): GrcBuiltinReferentiel | undefined {
  return BY_CODE[code]
}

const norm = (v: unknown): string =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Alias de noms d'affichage → code GRC (rétro-résolution des sélections historiques).
const NOM_INDEX: Record<string, string> = {
  'rgpd': 'RGPD',
  'gdpr': 'RGPD',
  'lcb ft': 'LCB_FT',
  'lcbft': 'LCB_FT',
  'blanchiment': 'LCB_FT',
  'gel des avoirs': 'SANCTIONS_GEL',
  'sanctions': 'SANCTIONS_GEL',
  'dsp2': 'DSP2',
  'sapin 2': 'SAPIN2',
  'sapin ii': 'SAPIN2',
  'anticorruption': 'SAPIN2',
  ...Object.fromEntries(GRC_BUILTINS.map(r => [norm(r.nom), r.code])),
}

/** Nom d'affichage → code GRC livré, ou null. */
export function grcCodeFromNom(nom: unknown): string | null {
  const n = norm(nom)
  return n ? (NOM_INDEX[n] ?? null) : null
}
