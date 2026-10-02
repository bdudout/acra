/**
 * Packs sectoriels étendus (catalogue 1.10) : agrège les packs par secteur écrits avec le constructeur
 * `catalogue-pack-builder`. Les éléments, la catégorie bâloise des risques et les liens « couvre ce risque »
 * sont fusionnés par `sector-suggestions`, `catalogue-risks` et `catalogue-links`.
 */
import type { SectorPack } from './catalogue-pack-builder'
import type { CatalogueItem } from './sector-suggestions'
import { DEFENSE_PACK } from './sector-packs-defense'
import { EDUCATION_PACK } from './sector-packs-education'
import { AGRICOLE_PACK } from './sector-packs-agricole'
import { IMMOBILIER_PACK } from './sector-packs-immobilier'
import { MEDIA_PACK } from './sector-packs-media'
import { TOURISME_PACK } from './sector-packs-tourisme'
import { ASSOCIATIONS_PACK } from './sector-packs-associations'

const PACKS: SectorPack[] = [DEFENSE_PACK, EDUCATION_PACK, AGRICOLE_PACK, IMMOBILIER_PACK, MEDIA_PACK, TOURISME_PACK, ASSOCIATIONS_PACK]

export const EXT_ITEMS: CatalogueItem[] = PACKS.flatMap(p => p.items)
export const EXT_BALE: SectorPack['bale'] = Object.assign({}, ...PACKS.map(p => p.bale))
export const EXT_CONTROL_RISKS: SectorPack['controlRisks'] = Object.assign({}, ...PACKS.map(p => p.controlRisks))
export const EXT_AUDIT_RISKS: SectorPack['auditRisks'] = Object.assign({}, ...PACKS.map(p => p.auditRisks))
