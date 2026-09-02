/**
 * org-config-defaults.ts — Valeurs par défaut de la configuration organisation
 * (types d'impacts et référentiels), administrables via /configuration.
 */

export interface TypeImpact {
  id: string
  label: string
  icon: string
}

export interface ReferentielActif {
  nom: string
  description: string
  actif: boolean
  /**
   * Code canonique du référentiel unifié (cadre livré ou custom), reliant la
   * sélection côté analyses aux exigences côté conformité/contrôles/audit.
   * `null`/absent = référentiel « label » sans cadre livré (résolu à la lecture par
   * referentielCodeFromNom, ou traité en custom). Cf. lib/referentiel-catalogue.ts.
   */
  code?: string | null
}

/** Types d'impacts par défaut (événements redoutés — Atelier 1). */
export const DEFAULT_TYPES_IMPACTS: TypeImpact[] = [
  { id: 'missions',    label: 'Missions & services',   icon: '🏢' },
  { id: 'humain',      label: 'Humain & sécurité',     icon: '👥' },
  { id: 'gouvernance', label: 'Gouvernance & conformité', icon: '⚖️' },
  { id: 'financier',   label: 'Financier',             icon: '💰' },
  { id: 'juridique',   label: 'Juridique & contractuel', icon: '📋' },
  { id: 'image',       label: 'Image & réputation',    icon: '📣' },
]

export interface StrategieTraitement {
  /** Identifiant interne, NON modifiable (référencé par les risques). */
  value: string
  /** Classe Tailwind de couleur du badge, NON modifiable. */
  color: string
  /** Libellé affiché — éditable par l'admin. */
  label: string
  /** Description — éditable. */
  description: string
  /** Conseil d'usage — éditable. */
  conseil: string
}

/** Options de traitement du risque par défaut (Atelier 5). */
export const DEFAULT_STRATEGIES: StrategieTraitement[] = [
  { value: 'REDUIRE',    color: 'bg-blue-100 text-blue-700',     label: 'Réduire',          description: "Mettre en place des mesures pour réduire la probabilité ou l'impact du risque", conseil: 'Stratégie recommandée pour les risques importants et critiques' },
  { value: 'ACCEPTER',   color: 'bg-green-100 text-green-700',   label: 'Accepter',         description: 'Accepter le risque tel quel, en connaissance de cause',                         conseil: 'À réserver aux risques résiduels faibles ou négligeables après traitement' },
  { value: 'TRANSFERER', color: 'bg-yellow-100 text-yellow-700', label: 'Transférer',       description: 'Transférer le risque à un tiers (assurance cyber, sous-traitant)',              conseil: 'Convient aux risques financiers ou pour lesquels un tiers est mieux équipé' },
  { value: 'REFUSER',    color: 'bg-red-100 text-red-700',       label: 'Refuser / Éviter', description: "Supprimer l'activité ou le processus à l'origine du risque",                    conseil: 'Si le risque est inacceptable et non traitable autrement' },
  { value: 'SURVEILLER', color: 'bg-purple-100 text-purple-700', label: 'Surveiller',       description: "Surveiller l'évolution du risque sans action immédiate",                        conseil: "Pour les risques émergents dont l'évolution est incertaine" },
]

/**
 * Référentiels de sécurité par défaut (tous actifs). `code` relie chaque entrée au
 * catalogue canonique unifié — même objet côté analyses et côté conformité/contrôles.
 * `null` = label sans cadre livré (RGPD → futur builtin P3 ; NIS2, LPM, ISO 27002
 * tenus distincts / custom). Cf. lib/referentiel-catalogue.ts (table de correspondance).
 */
export const DEFAULT_REFERENTIELS: ReferentielActif[] = [
  { nom: 'ISO/IEC 27001:2022', description: "Système de Management de la Sécurité de l'Information", actif: true, code: 'ISO27001' },
  { nom: 'ISO/IEC 27002:2022', description: "Mesures de sécurité de l'information", actif: true, code: null },
  { nom: 'RGPD',  description: 'Règlement Général sur la Protection des Données', actif: true, code: null },
  { nom: 'NIS2',  description: 'Directive européenne sécurité des réseaux et systèmes', actif: true, code: null },
  { nom: 'RGS',   description: 'Référentiel Général de Sécurité (ANSSI)', actif: true, code: 'RGS' },
  { nom: 'HDS',   description: 'Hébergeur de Données de Santé', actif: true, code: 'HDS' },
  { nom: 'PCI-DSS', description: 'Payment Card Industry Data Security Standard', actif: true, code: 'PCI_DSS' },
  { nom: 'SOC 2', description: 'Service Organization Control 2', actif: true, code: 'SOC2' },
  { nom: 'LPM',   description: 'Loi de Programmation Militaire (OIV)', actif: true, code: null },
  { nom: 'DORA',  description: 'Digital Operational Resilience Act (secteur financier)', actif: true, code: 'DORA' },
  { nom: 'CIS Controls v8', description: 'Center for Internet Security Controls', actif: true, code: 'CIS_V8' },
  { nom: 'NIST CSF 2.0', description: 'NIST Cybersecurity Framework', actif: true, code: 'NIST_CSF' },
]
