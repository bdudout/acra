// ─── Domaines de référentiel (univers de contrôle & audit GRC) ───────────────
// Un « domaine » classe un référentiel dans une FILIÈRE de risque/contrôle, pour
// permettre les contrôles et audits AU-DELÀ du cyber (LCB-FT, gel des avoirs,
// déontologie, comptable, octroi de crédit…). Aligné sur les filières du contrôle
// interne bancaire (arrêté du 3 nov. 2014 modifié) + assurance/entreprise.
// Enum stable et EXTENSIBLE ; logique PURE et testée. Cf. docs/referentiels-univers-grc.md.

export const DOMAINES = [
  'SECURITE_SI',
  'PROTECTION_DONNEES',
  'LCB_FT',
  'SANCTIONS_GEL',
  'PROTECTION_CLIENTELE',
  'DEONTOLOGIE',
  'COMPTABLE_FINANCIER',
  'CREDIT_CONTREPARTIE',
  'RISQUE_OPERATIONNEL',
  'GOUVERNANCE_CONTROLE',
  'AUTRE',
] as const

export type Domaine = (typeof DOMAINES)[number]

// Défaut : SECURITE_SI — tous les référentiels existants (cyber) y sont rattachés,
// donc l'ajout du domaine est rétrocompatible (rien à migrer côté sens métier).
export const DEFAULT_DOMAINE: Domaine = 'SECURITE_SI'

export interface DomaineMeta {
  /** Libellé lisible (FR). L'UI localisée passera par les clés i18n en phase 3. */
  label: string
  /** Ce que le domaine couvre (aide à la classification). */
  description: string
}

export const DOMAINE_META: Record<Domaine, DomaineMeta> = {
  SECURITE_SI: {
    label: 'Sécurité SI & résilience numérique',
    description: 'Cyber, SSI, DORA, continuité TIC — cadres de sécurité de l’information.',
  },
  PROTECTION_DONNEES: {
    label: 'Protection des données',
    description: 'RGPD, secret bancaire, données de santé — traitement des données personnelles.',
  },
  LCB_FT: {
    label: 'Lutte anti-blanchiment & financement du terrorisme',
    description: 'KYC, vigilance, PPE, déclarations de soupçon (Tracfin), conservation, formation.',
  },
  SANCTIONS_GEL: {
    label: 'Sanctions & gel des avoirs',
    description: 'Mesures restrictives UE/ONU/OFAC, filtrage des listes, gel sans délai, embargos.',
  },
  PROTECTION_CLIENTELE: {
    label: 'Protection de la clientèle & commercialisation',
    description: 'DSP2, MIF 2, IDD (assurance), information et conseil au client.',
  },
  DEONTOLOGIE: {
    label: 'Déontologie, conflits d’intérêts & anticorruption',
    description: 'Sapin II, abus de marché, cadeaux/avantages, transactions personnelles.',
  },
  COMPTABLE_FINANCIER: {
    label: 'Fiabilité comptable & financière',
    description: 'Piste d’audit, contrôle interne comptable (arrêté 3 nov. 2014), IFRS, reporting.',
  },
  CREDIT_CONTREPARTIE: {
    label: 'Octroi & suivi des crédits',
    description: 'Procédures d’octroi, délégations, notation, EBA LOM, provisionnement.',
  },
  RISQUE_OPERATIONNEL: {
    label: 'Risque opérationnel & externalisation',
    description: 'PCA/continuité, pertes opérationnelles, prestataires critiques (DORA art. 28, EBA).',
  },
  GOUVERNANCE_CONTROLE: {
    label: 'Gouvernance & dispositif de contrôle interne',
    description: 'Arrêté 3 nov. 2014, CRD/CRR, Solvabilité II — pilotage du contrôle interne.',
  },
  AUTRE: {
    label: 'Autre / interne non classé',
    description: 'Référentiels internes ne relevant pas des filières ci-dessus.',
  },
}

/** Vrai si `v` est un code de domaine connu. */
export function isDomaine(v: unknown): v is Domaine {
  return typeof v === 'string' && (DOMAINES as readonly string[]).includes(v)
}

/** Borne une valeur au domaine : retombe sur le défaut si inconnue (rétrocompatible). */
export function coerceDomaine(v: unknown): Domaine {
  return isDomaine(v) ? v : DEFAULT_DOMAINE
}

/** Libellé lisible d'un domaine ; défaut si le code est inconnu. */
export function domaineLabel(v: unknown): string {
  return DOMAINE_META[coerceDomaine(v)].label
}
