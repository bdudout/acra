/**
 * org-config.ts — Configuration PAR organisation avec héritage (multi-organisation, L2).
 *
 * Module pur (sans Prisma) → testé unitairement. Le helper serveur
 * `org-config.server.ts` récupère la chaîne d'organisations (nœud + ancêtres via le
 * chemin matérialisé) et appelle `resolveOrgConfig`.
 *
 * Règle d'héritage (chaîne ordonnée du nœud vers la racine) :
 *  - champ JSON (tableaux/objets)  → la 1ʳᵉ valeur NON VIDE en remontant gagne ;
 *  - booléen (toggle de feature)   → la 1ʳᵉ organisation possédant un row gagne ;
 *  - sinon → valeur par défaut.
 */

import {
  DEFAULT_TYPES_IMPACTS,
  DEFAULT_REFERENTIELS,
  DEFAULT_STRATEGIES,
  type TypeImpact,
  type ReferentielActif,
  type StrategieTraitement,
} from '@/lib/org-config-defaults'

/** Entités responsables de mesures par défaut. */
export const DEFAULT_ENTITES = ['DSI', 'Métier', 'Risques', 'RH', 'Juridique']

/** Forme « brute » d'un row OrganizationConfig (telle que stockée). */
export interface RawOrgConfig {
  entitesMesures: unknown
  typesImpacts: unknown
  referentielsActifs: unknown
  strategiesTraitement: unknown
  exemplesAteliers: unknown
  echellesEcosysteme: unknown
  qualificationActive: boolean
  qualificationObligatoire: boolean
  conformiteActive: boolean
  conformiteNiveau: string
  conformiteSnapshotMode: string
  conseilsAteliersActive: boolean
  acceptationRisquesActive: boolean
  derogationsActive: boolean
  derogationDureeDefautJours: number
  derogationAlerteJours: number
  derogationWorkflow: string
  derogationDoubleRegard: boolean
  derogationSortCatalogue: boolean
}

/** Configuration effective résolue (héritage appliqué). */
export interface OrgConfigResolved {
  entitesMesures: string[]
  typesImpacts: TypeImpact[]
  referentielsActifs: ReferentielActif[]
  strategiesTraitement: StrategieTraitement[]
  exemplesAteliers: Record<string, unknown[]>
  echellesEcosysteme: Record<string, unknown>
  qualificationActive: boolean
  qualificationObligatoire: boolean
  conformiteActive: boolean
  conformiteNiveau: string
  conformiteSnapshotMode: string
  conseilsAteliersActive: boolean
  acceptationRisquesActive: boolean
  derogationsActive: boolean
  derogationDureeDefautJours: number
  derogationAlerteJours: number
  derogationWorkflow: string
  derogationDoubleRegard: boolean
  derogationSortCatalogue: boolean
}

export const DEFAULT_ORG_CONFIG: OrgConfigResolved = {
  entitesMesures: DEFAULT_ENTITES,
  typesImpacts: DEFAULT_TYPES_IMPACTS,
  referentielsActifs: DEFAULT_REFERENTIELS,
  strategiesTraitement: DEFAULT_STRATEGIES,
  exemplesAteliers: {},
  echellesEcosysteme: {},
  qualificationActive: false,
  qualificationObligatoire: false,
  // Module conformité activé par défaut (résolution des orgs sans valeur explicite).
  conformiteActive: true,
  conformiteNiveau: 'ANALYSE',
  conformiteSnapshotMode: 'MANUEL',
  conseilsAteliersActive: true,
  acceptationRisquesActive: false,
  derogationsActive: false,
  derogationDureeDefautJours: 180,
  derogationAlerteJours: 30,
  derogationWorkflow: 'RSSI',
  derogationDoubleRegard: true,
  derogationSortCatalogue: true,
}

/** Une valeur JSON est « vide » (⇒ hérite) si null/undefined, [] ou {}. */
function isEmptyJson(v: unknown): boolean {
  if (v == null) return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as object).length === 0
  return false
}

type JsonKey = 'entitesMesures' | 'typesImpacts' | 'referentielsActifs' | 'strategiesTraitement' | 'exemplesAteliers' | 'echellesEcosysteme'
type BoolKey = 'qualificationActive' | 'qualificationObligatoire' | 'conformiteActive' | 'conseilsAteliersActive' | 'acceptationRisquesActive' | 'derogationsActive' | 'derogationDoubleRegard' | 'derogationSortCatalogue'
type StrKey = 'conformiteNiveau' | 'conformiteSnapshotMode' | 'derogationWorkflow'
type IntKey = 'derogationDureeDefautJours' | 'derogationAlerteJours'

/**
 * Résout la configuration effective d'une organisation à partir de la chaîne de ses
 * rows ordonnée du NŒUD vers la RACINE (self-first ; `null` = pas de row à ce niveau).
 */
export function resolveOrgConfig(chainSelfFirst: (RawOrgConfig | null)[], defaults: OrgConfigResolved = DEFAULT_ORG_CONFIG): OrgConfigResolved {
  const pickJson = <T,>(key: JsonKey, def: T): T => {
    for (const row of chainSelfFirst) {
      if (row && !isEmptyJson(row[key])) return row[key] as T
    }
    return def
  }
  const pickBool = (key: BoolKey, def: boolean): boolean => {
    for (const row of chainSelfFirst) {
      if (row && typeof row[key] === 'boolean') return row[key]
    }
    return def
  }
  const pickStr = (key: StrKey, def: string): string => {
    for (const row of chainSelfFirst) {
      const v = row?.[key]
      if (typeof v === 'string' && v) return v
    }
    return def
  }
  const pickInt = (key: IntKey, def: number): number => {
    for (const row of chainSelfFirst) {
      const v = (row as Record<string, unknown> | null)?.[key]
      if (typeof v === 'number' && Number.isFinite(v)) return v
    }
    return def
  }
  return {
    entitesMesures: pickJson('entitesMesures', defaults.entitesMesures),
    typesImpacts: pickJson('typesImpacts', defaults.typesImpacts),
    referentielsActifs: pickJson('referentielsActifs', defaults.referentielsActifs),
    strategiesTraitement: pickJson('strategiesTraitement', defaults.strategiesTraitement),
    exemplesAteliers: pickJson('exemplesAteliers', defaults.exemplesAteliers),
    echellesEcosysteme: pickJson('echellesEcosysteme', defaults.echellesEcosysteme),
    qualificationActive: pickBool('qualificationActive', defaults.qualificationActive),
    qualificationObligatoire: pickBool('qualificationObligatoire', defaults.qualificationObligatoire),
    conformiteActive: pickBool('conformiteActive', defaults.conformiteActive),
    conformiteNiveau: pickStr('conformiteNiveau', defaults.conformiteNiveau),
    conformiteSnapshotMode: pickStr('conformiteSnapshotMode', defaults.conformiteSnapshotMode),
    conseilsAteliersActive: pickBool('conseilsAteliersActive', defaults.conseilsAteliersActive),
    acceptationRisquesActive: pickBool('acceptationRisquesActive', defaults.acceptationRisquesActive),
    derogationsActive: pickBool('derogationsActive', defaults.derogationsActive),
    derogationDureeDefautJours: pickInt('derogationDureeDefautJours', defaults.derogationDureeDefautJours),
    derogationAlerteJours: pickInt('derogationAlerteJours', defaults.derogationAlerteJours),
    derogationWorkflow: pickStr('derogationWorkflow', defaults.derogationWorkflow),
    derogationDoubleRegard: pickBool('derogationDoubleRegard', defaults.derogationDoubleRegard),
    derogationSortCatalogue: pickBool('derogationSortCatalogue', defaults.derogationSortCatalogue),
  }
}
