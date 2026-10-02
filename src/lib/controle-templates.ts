/**
 * Catalogue UNIFIÉ des contrôles-types : une seule liste, trois portes d'entrée au choix du
 * contrôleur (cf. ControleCataloguePanel) :
 *  - par RÉFÉRENTIEL : socles reliés aux exigences réelles (`controles-catalogue.ts` : ISO 27001,
 *    DORA, LCB-FT…), contenu en français (traduction à faire, terminologie réglementaire) ;
 *  - par PROCESSUS et par RISQUE : contrôles-types du catalogue sectoriel (×5 langues), rattachés à
 *    un processus et aux risques qu'ils couvrent (`catalogue-links.ts`).
 * Chaque modèle a une clé stable (provenance `Controle.catalogueKey`) : un même modèle n'est jamais
 * importé deux fois, quelle que soit la porte d'entrée. Module pur → testable.
 */
import { CATALOGUES_CONTROLES } from './controles-catalogue'
import type { ControleNiveau, Periodicite } from './controle'
import { listSectorSuggestions, type CatalogueLocale, type SectorScope } from './sector-suggestions'

/** Version des socles par référentiel. Règle : n'ajouter un contrôle qu'en FIN de socle (la clé dépend du rang). */
export const REFERENTIEL_CONTROLES_VERSION = 'ref-1.0'

export type ControlTemplate = {
  key: string
  origin: 'REFERENTIEL' | 'CATALOGUE'
  title: string
  description?: string
  niveau?: ControleNiveau
  periodicite: Periodicite
  controlType?: 'PREVENTIF' | 'DETECTIF' | 'CORRECTIF'
  referentiel?: { id: string; nom: string; code: string; exigenceRefs: string[] }
  checklist: string[]
  processKey?: string
  riskKeys: string[]
  sector: string
  version: string
  /** Langue réelle du contenu (les socles par référentiel sont encore en français). */
  contentLocale: CatalogueLocale
}

export const referentielTemplateKey = (socleId: string, index: number) => `ref.${socleId.toLowerCase()}.${index + 1}`

export function listControlTemplates(sectors: SectorScope, locale: CatalogueLocale) {
  const suggestions = listSectorSuggestions(sectors, locale)
  const fromReferentiels: ControlTemplate[] = CATALOGUES_CONTROLES.flatMap(socle => socle.controles.map((c, i) => ({
    key: referentielTemplateKey(socle.id, i), origin: 'REFERENTIEL' as const,
    title: c.intitule, description: c.description, niveau: c.niveau, periodicite: c.periodicite,
    referentiel: { id: socle.id, nom: socle.nom, code: c.referentielCode, exigenceRefs: c.exigenceRefs },
    checklist: c.checklist, riskKeys: [], sector: 'TRANSVERSAL', version: REFERENTIEL_CONTROLES_VERSION, contentLocale: 'fr' as const,
  })))
  const fromCatalogue: ControlTemplate[] = suggestions.filter(s => s.kind === 'CONTROL').map(s => ({
    key: s.key, origin: 'CATALOGUE' as const, title: s.title, periodicite: s.periodicite ?? 'TRIMESTRIEL',
    controlType: s.controlType, checklist: [], processKey: s.processKey, riskKeys: s.riskKeys ?? [],
    sector: s.sector, version: s.packVersion, contentLocale: locale,
  }))
  return {
    templates: [...fromReferentiels, ...fromCatalogue],
    referentiels: CATALOGUES_CONTROLES.map(socle => ({ id: socle.id, nom: socle.nom, count: socle.controles.length })),
    processes: suggestions.filter(s => s.kind === 'PROCESS').map(s => ({ key: s.key, title: s.title, parentKey: s.parentKey })),
    risks: suggestions.filter(s => s.kind === 'RISK').map(s => ({ key: s.key, title: s.title })),
  }
}
