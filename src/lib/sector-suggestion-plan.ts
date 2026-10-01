import { listSectorSuggestions, type CatalogueLocale, type SectorScope, type SectorSuggestion } from '@/lib/sector-suggestions'

export type SuggestionPlan = {
  toCreate: SectorSuggestion[]
  alreadyImported: string[]
  invalidKeys: string[]
  unlinked: Array<{ key: string; dependencyKey: string }>
}

/**
 * Plan sans accès DB : les liens non sélectionnés ne sont jamais inventés.
 * L'appelant fournit les clés déjà importées dans l'organisation ; un même item
 * peut avoir été renommé sans être réimporté.
 */
export function planSuggestionSelection(input: {
  sector: SectorScope
  locale: CatalogueLocale
  selectedKeys: string[]
  existingKeys: string[]
}): SuggestionPlan {
  const available = new Map(listSectorSuggestions(input.sector, input.locale).map(item => [item.key, item]))
  const existing = new Set(input.existingKeys)
  const selected = [...new Set(input.selectedKeys)].slice(0, 100)
  const selectedSet = new Set(selected)
  const invalidKeys = selected.filter(key => !available.has(key))
  const alreadyImported = selected.filter(key => available.has(key) && existing.has(key))
  const pending = selected
    .filter(key => available.has(key) && !existing.has(key))
    .map(key => available.get(key)!)
  const processes = pending.filter(item => item.kind === 'PROCESS')
  const risks = pending.filter(item => item.kind === 'RISK')
  const byKey = available
  const depth = (item: SectorSuggestion): number => { let d = 0; let parent = item.parentKey; while (parent && d < 10) { d += 1; parent = byKey.get(parent)?.parentKey } return d }
  processes.sort((a, b) => depth(a) - depth(b))
  const controls = pending.filter(item => item.kind === 'CONTROL')
  const kris = pending.filter(item => item.kind === 'KRI')
  const audits = pending.filter(item => item.kind === 'AUDIT')
  const tests = pending.filter(item => item.kind === 'RESILIENCE_TEST')
  const toCreate = [...processes, ...risks, ...controls, ...kris, ...audits, ...tests]
  const unlinked: SuggestionPlan['unlinked'] = []
  for (const item of pending) {
    const dependencyKey = item.kind === 'PROCESS' ? item.parentKey : item.processKey
    if (dependencyKey && !selectedSet.has(dependencyKey) && !existing.has(dependencyKey)) {
      unlinked.push({ key: item.key, dependencyKey })
    }
  }
  return { toCreate, alreadyImported, invalidKeys, unlinked }
}
