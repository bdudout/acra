/** Reconnaissance pure et prudente des feuilles historiques avant mapping humain. */
export type HistoricSheetType = 'ANALYSES' | 'RISKS' | 'VULNERABILITIES' | 'MEASURES' | 'ACTIONS' | 'RISK_ACTION_LINKS' | 'UNKNOWN'
export type HistoricSheetDetection = { type: HistoricSheetType; confidence: 'HIGH' | 'MEDIUM' | 'NONE'; missing: string[] }

function normalise(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

const matches = (values: string[], terms: string[]) => terms.some(term => values.some(value => value.includes(term)))

export function detectHistoricImportSheet(name: string, columns: string[]): HistoricSheetDetection {
  const haystack = [normalise(name), ...columns.map(normalise)]
  if (matches(haystack, ['vulnerabilite', 'vulnerability']) && matches(haystack, ['risque', 'risk'])) return { type: 'VULNERABILITIES', confidence: 'HIGH', missing: [] }
  if (matches(haystack, ['risque', 'risk']) && matches(haystack, ['gravite', 'impact', 'vraisemblance', 'probabilite', 'likelihood'])) return { type: 'RISKS', confidence: 'HIGH', missing: [] }
  if (matches(haystack, ['plan action', 'action id', 'intitule action']) && matches(haystack, ['echeance', 'responsable'])) return { type: 'ACTIONS', confidence: 'MEDIUM', missing: [] }
  if (matches(haystack, ['mesure']) && matches(haystack, ['responsable', 'statut'])) return { type: 'MEASURES', confidence: 'MEDIUM', missing: [] }
  if (matches(haystack, ['analyse']) && matches(haystack, ['methode', 'perimetre'])) return { type: 'ANALYSES', confidence: 'MEDIUM', missing: [] }
  if (matches(haystack, ['lien risque action', 'risk action link'])) return { type: 'RISK_ACTION_LINKS', confidence: 'MEDIUM', missing: [] }
  return { type: 'UNKNOWN', confidence: 'NONE', missing: [] }
}

export type HistoricColumnMapping = Record<string, string | undefined>

/** Champs minimaux avant l'import : les cotations facultatives ne sont jamais inventées. */
export function validateHistoricColumnMapping(type: HistoricSheetType, mapping: HistoricColumnMapping): string[] {
  const required: Partial<Record<HistoricSheetType, string[]>> = {
    ANALYSES: ['title'],
    RISKS: ['title'],
    VULNERABILITIES: ['riskExternalId', 'title'],
    MEASURES: ['title'],
    ACTIONS: ['title'],
    RISK_ACTION_LINKS: ['riskExternalId', 'actionExternalId'],
  }
  return (required[type] ?? []).filter(key => !mapping[key]?.trim())
}

const COLUMN_ALIASES: Record<string, string[]> = {
  externalId: ['reference', 'ref', 'id externe', 'external id', 'risk id', 'action id'], title: ['libelle de risque', 'risk label', 'intitule', 'titre', 'nom', 'libelle'],
  gravity: ['gravite', 'severity', 'impact'], likelihood: ['vraisemblance', 'probabilite', 'likelihood'],
  description: ['description', 'detail', 'commentaire'], strategy: ['strategie', 'traitement'],
  status: ['statut', 'etat'], responsible: ['responsable', 'porteur', 'owner'], dueDate: ['echeance', 'date cible', 'due date'],
  riskExternalId: ['reference risque', 'risque id', 'risk id', 'risk reference'], actionExternalId: ['reference action', 'action id', 'action reference'],
  analysisExternalId: ['reference analyse', 'analyse id', 'analyse external id', 'analysis id', 'analysis external id', 'analysis reference'],
}

/** Suggestions transparentes : le mapping est affiché et reste modifiable avant validation. */
export function suggestHistoricColumnMapping(columns: string[]): HistoricColumnMapping {
  const normalized = columns.map(column => ({ raw: column, value: normalise(column) }))
  return Object.fromEntries(Object.entries(COLUMN_ALIASES).flatMap(([field, aliases]) => {
    const match = normalized.find(column => aliases.some(alias => column.value.includes(alias)))
    return match ? [[field, match.raw]] : []
  }))
}

export type HistoricImportRow = Record<string, string>
export type HistoricImportSheet = { type: HistoricSheetType; mapping: HistoricColumnMapping; rows: HistoricImportRow[] }
export type HistoricImportPackage = {
  analysis: { title: string; description?: string }
  risks: Array<{ externalId?: string; title: string; description?: string; gravity?: number; likelihood?: number; strategy?: string }>
  vulnerabilities: Array<{ riskExternalId: string; title: string; description?: string }>
  measures: Array<{ externalId?: string; riskExternalId?: string; title: string; description?: string; status?: string; responsible?: string; dueDate?: string }>
  actions: Array<{ externalId?: string; riskExternalId?: string; title: string; description?: string; responsible?: string; dueDate?: string }>
  links: Array<{ riskExternalId: string; actionExternalId: string }>
}

const text = (row: HistoricImportRow, column: string | undefined): string | undefined => {
  const value = column ? row[column]?.trim() : undefined
  return value || undefined
}
const score = (row: HistoricImportRow, column: string | undefined): number | undefined => {
  const value = Number(text(row, column))
  return Number.isFinite(value) && value >= 1 && value <= 4 ? Math.round(value) : undefined
}

/** Transforme des lignes Excel déjà mappées en contrat d'import explicite, sans I/O ni écriture. */
export function buildHistoricImportPackage(sheets: HistoricImportSheet[], fallbackTitle: string): HistoricImportPackage {
  const result: HistoricImportPackage = { analysis: { title: fallbackTitle.slice(0, 200) || 'Analyse importée' }, risks: [], vulnerabilities: [], measures: [], actions: [], links: [] }
  for (const sheet of sheets) for (const row of sheet.rows) {
    const title = text(row, sheet.mapping.title)
    if (sheet.type === 'ANALYSES' && title && result.analysis.title === fallbackTitle) {
      result.analysis = { title: title.slice(0, 200), description: text(row, sheet.mapping.description)?.slice(0, 2000) }
    }
    if (sheet.type === 'RISKS' && title) result.risks.push({ externalId: text(row, sheet.mapping.externalId), title: title.slice(0, 255), description: text(row, sheet.mapping.description)?.slice(0, 2000), gravity: score(row, sheet.mapping.gravity), likelihood: score(row, sheet.mapping.likelihood), strategy: text(row, sheet.mapping.strategy) })
    if (sheet.type === 'VULNERABILITIES' && title) {
      const riskExternalId = text(row, sheet.mapping.riskExternalId)
      if (riskExternalId) result.vulnerabilities.push({ riskExternalId, title: title.slice(0, 500), description: text(row, sheet.mapping.description)?.slice(0, 2000) })
    }
    if (sheet.type === 'MEASURES' && title) result.measures.push({ externalId: text(row, sheet.mapping.externalId), riskExternalId: text(row, sheet.mapping.riskExternalId), title: title.slice(0, 255), description: text(row, sheet.mapping.description)?.slice(0, 2000), status: text(row, sheet.mapping.status), responsible: text(row, sheet.mapping.responsible), dueDate: text(row, sheet.mapping.dueDate) })
    if (sheet.type === 'ACTIONS' && title) result.actions.push({ externalId: text(row, sheet.mapping.externalId), riskExternalId: text(row, sheet.mapping.riskExternalId), title: title.slice(0, 255), description: text(row, sheet.mapping.description)?.slice(0, 2000), responsible: text(row, sheet.mapping.responsible), dueDate: text(row, sheet.mapping.dueDate) })
    if (sheet.type === 'RISK_ACTION_LINKS') {
      const riskExternalId = text(row, sheet.mapping.riskExternalId)
      const actionExternalId = text(row, sheet.mapping.actionExternalId)
      if (riskExternalId && actionExternalId) result.links.push({ riskExternalId, actionExternalId })
    }
  }
  return result
}

/** Découpe un classeur multi-analyses par référence source, sans mélanger leurs lignes. */
export function buildHistoricImportPackages(sheets: HistoricImportSheet[], fallbackTitle: string): HistoricImportPackage[] {
  const analyses = sheets.filter(sheet => sheet.type === 'ANALYSES').flatMap(sheet => sheet.rows.map(row => ({ sheet, row, id: text(row, sheet.mapping.externalId) }))).filter(item => item.id)
  if (analyses.length < 2) return [buildHistoricImportPackage(sheets, fallbackTitle)]
  return analyses.map(({ row: analysisRow, id }) => {
    const riskIds = new Set(sheets.filter(sheet => sheet.type === 'RISKS').flatMap(sheet => sheet.rows.filter(row => text(row, sheet.mapping.analysisExternalId) === id).flatMap(row => { const riskId = text(row, sheet.mapping.externalId); return riskId ? [riskId] : [] })))
    return buildHistoricImportPackage(sheets.map(sheet => {
    if (sheet.type === 'ANALYSES') return { ...sheet, rows: [analysisRow] }
    const column = sheet.mapping.analysisExternalId
    if (column) return { ...sheet, rows: sheet.rows.filter(row => text(row, column) === id) }
    if (sheet.mapping.riskExternalId) return { ...sheet, rows: sheet.rows.filter(row => riskIds.has(text(row, sheet.mapping.riskExternalId) ?? '')) }
    return sheet
  }), fallbackTitle)
  })
}
