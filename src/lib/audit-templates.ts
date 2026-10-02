/**
 * Modèles de mission d'audit UNIFIÉS : l'auditeur choisit sa porte d'entrée (cf. AuditModelePicker) :
 *  - par RÉFÉRENTIEL : programmes types (`audit-programmes-catalogue.ts` : ISO 27001, DORA, LCB-FT…),
 *    contenu en français (traduction à faire, terminologie réglementaire) ;
 *  - par PROCESSUS et par RISQUE : missions types du catalogue sectoriel (×5 langues), rattachées à un
 *    processus et aux risques qu'elles couvrent (`catalogue-links.ts`).
 * Un modèle PRÉREMPLIT le formulaire de mission (intitulé, points de revue, processus) : l'auditeur
 * décide, rien n'est créé sans enregistrement. Module pur → testable.
 */
import { PROGRAMMES_AUDIT } from './audit-programmes-catalogue'
import { listSectorSuggestions, type CatalogueLocale, type SectorScope } from './sector-suggestions'

export type AuditTemplate = {
  key: string
  origin: 'REFERENTIEL' | 'CATALOGUE'
  title: string
  points: string[]
  referentiel?: { id: string; nom: string }
  processKey?: string
  riskKeys: string[]
  contentLocale: CatalogueLocale
}

export function listAuditTemplates(sectors: SectorScope, locale: CatalogueLocale) {
  const suggestions = listSectorSuggestions(sectors, locale)
  const fromReferentiels: AuditTemplate[] = PROGRAMMES_AUDIT.map(p => ({
    key: `ref.${p.id.toLowerCase()}`, origin: 'REFERENTIEL', title: p.nom, points: p.points,
    referentiel: { id: p.id, nom: p.nom }, riskKeys: [], contentLocale: 'fr',
  }))
  const fromCatalogue: AuditTemplate[] = suggestions.filter(s => s.kind === 'AUDIT').map(s => ({
    key: s.key, origin: 'CATALOGUE', title: s.title, points: s.points ?? [], processKey: s.processKey, riskKeys: s.riskKeys ?? [], contentLocale: locale,
  }))
  return {
    templates: [...fromReferentiels, ...fromCatalogue],
    processes: suggestions.filter(s => s.kind === 'PROCESS').map(s => ({ key: s.key, title: s.title })),
    risks: suggestions.filter(s => s.kind === 'RISK').map(s => ({ key: s.key, title: s.title })),
  }
}
