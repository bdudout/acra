/**
 * Grille de REVUE MÉTIER du catalogue de suggestions (processus, risques, contrôles, KRI,
 * missions d'audit, plans de test de résilience). Module PUR : une ligne par élément, libellés
 * dans les 5 langues, attributs suggérés, version d'ajout, et colonnes vides « Avis » /
 * « Commentaire » à remplir par les relecteurs métier. Régénérée par
 * `npm run catalogue:review` (fichier docs/specs/catalogue-revue-grille.csv, tenu à jour par un test).
 */
import { SECTOR_CODES, listSectorSuggestions, type CatalogueLocale, type SectorSuggestion } from './sector-suggestions'
import { CATALOGUE_CHANGELOG } from './sector-suggestions-changelog'
import { sanitizeForSpreadsheet } from './spreadsheet-safe'

const LOCALES: CatalogueLocale[] = ['fr', 'en', 'de', 'es', 'it']

export const REVIEW_COLUMNS = [
  'Clé', 'Ajouté en', 'Secteur', 'Nature', 'Rattachement (clé)', 'Rattachement (FR)',
  'Libellé FR', 'Libellé EN', 'Libellé DE', 'Libellé ES', 'Libellé IT',
  'Attributs suggérés', 'Points de revue (FR)', 'Avis (OK / À revoir / Retirer)', 'Commentaire',
] as const

const KIND_FR: Record<SectorSuggestion['kind'], string> = {
  PROCESS: 'Processus', RISK: 'Risque (événement-type)', CONTROL: 'Contrôle-type', KRI: 'KRI candidat', AUDIT: 'Mission d’audit type', RESILIENCE_TEST: 'Plan de test de résilience',
}

/** Version du catalogue où la clé est apparue (1.0 = socle initial). */
export function addedIn(key: string): string {
  return CATALOGUE_CHANGELOG.find(entry => entry.added.includes(key))?.version ?? '1.0'
}

/** Tous les éléments du catalogue, une fois chacun (socle puis secteurs), libellés par langue. */
export function buildCatalogueReviewRows(): string[][] {
  const byLocale = new Map(LOCALES.map(locale => {
    const all = new Map<string, SectorSuggestion>()
    for (const sector of [null, ...SECTOR_CODES]) for (const item of listSectorSuggestions(sector, locale)) if (!all.has(item.key)) all.set(item.key, item)
    return [locale, all] as const
  }))
  const fr = byLocale.get('fr')!
  return [...fr.values()].map(item => {
    const dependency = item.kind === 'PROCESS' ? item.parentKey : item.processKey
    const attrs = [
      item.periodicite && `périodicité ${item.periodicite}`,
      item.controlType && `type ${item.controlType}`,
      item.unite && `unité ${item.unite}`,
      item.sens && `dégradation à la ${item.sens === 'HAUSSE' ? 'hausse' : 'baisse'}`,
      item.testType && `type de test ${item.testType}`,
    ].filter(Boolean).join(' ; ')
    return [
      item.key, addedIn(item.key), item.sector, KIND_FR[item.kind], dependency ?? '', dependency ? fr.get(dependency)?.title ?? '' : '',
      ...LOCALES.map(locale => byLocale.get(locale)!.get(item.key)!.title),
      attrs, (item.points ?? []).join(' | '), '', '',
    ]
  })
}

/** CSV « ; » avec BOM UTF-8 (ouverture directe dans un tableur en français), cellules neutralisées. */
export function catalogueReviewCsv(): string {
  const cell = (value: string) => `"${sanitizeForSpreadsheet(value).replace(/"/g, '""')}"`
  const lines = [REVIEW_COLUMNS as readonly string[], ...buildCatalogueReviewRows()].map(row => row.map(cell).join(';'))
  return `\uFEFF${lines.join('\n')}\n`
}
