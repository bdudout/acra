/** Reconnaissance pure et prudente des feuilles historiques avant mapping humain. */
export type HistoricSheetType = 'ANALYSES' | 'RISKS' | 'VULNERABILITIES' | 'MEASURES' | 'ACTIONS' | 'RISK_ACTION_LINKS' | 'UNKNOWN'
export type HistoricSheetDetection = { type: HistoricSheetType; confidence: 'HIGH' | 'MEDIUM' | 'NONE'; missing: string[] }

/** La détection est une suggestion : le rôle choisi dans l'assistant prévaut. */
export function resolveHistoricImportSheetType(detected: HistoricSheetType, selected?: HistoricSheetType): HistoricSheetType {
  return selected ?? detected
}

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
/**
 * Transformation explicitement choisie par l'utilisateur pour une cellule qui
 * représente plusieurs objets. Aucun séparateur n'est déduit silencieusement :
 * une virgule, par exemple, peut légitimement appartenir à un intitulé.
 */
export type HistoricValueTransform = { mode?: 'LINES' | 'SEMICOLON' | 'PIPE'; carryForward?: boolean }
export type HistoricFieldTransforms = Record<string, HistoricValueTransform | undefined>
export const HISTORIC_MULTI_COLUMN_SEPARATOR = '\u001F'
export const splitHistoricMappedColumns = (mapping: string | undefined) => mapping?.split(HISTORIC_MULTI_COLUMN_SEPARATOR).filter(Boolean) ?? []

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

export type HistoricSheetColumn = { key: string; label: string; index: number }
export type HistoricHeaderLayout = { headerRowIndex: number; columns: HistoricSheetColumn[] }
const spreadsheetColumn = (index: number) => {
  let value = index + 1
  let result = ''
  while (value > 0) { const remainder = (value - 1) % 26; result = String.fromCharCode(65 + remainder) + result; value = Math.floor((value - 1) / 26) }
  return result
}

/**
 * Identifie la ligne d'en-tête la plus plausible parmi les premières lignes,
 * plutôt que de présumer que tout classeur démarre en A1. Les indices Excel
 * sont conservés : une colonne vide ne peut donc pas décaler les valeurs.
 */
export function detectHistoricHeaderLayout(rows: string[][]): HistoricHeaderLayout {
  const candidates = rows.slice(0, 20).map((row, headerRowIndex) => {
    const values = row.map(value => value.trim())
    const nonEmpty = values.filter(Boolean)
    const aliases = Object.values(COLUMN_ALIASES).flat()
    const aliasMatches = nonEmpty.filter(value => {
      const normalized = normalise(value)
      return aliases.some(alias => normalized.includes(alias))
    }).length
    return { headerRowIndex, values, score: nonEmpty.length >= 2 ? aliasMatches * 10 + Math.min(nonEmpty.length, 8) : -1 }
  })
  const selected = candidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best, candidates[0] ?? { headerRowIndex: 0, values: [], score: -1 })
  const seen = new Map<string, number>()
  const columns = selected.values.flatMap((label, index) => {
    if (!label) return []
    const occurrence = seen.get(label) ?? 0
    seen.set(label, occurrence + 1)
    return [{ key: occurrence === 0 ? label : `${label} [${spreadsheetColumn(index)}]`, label, index }]
  })
  return { headerRowIndex: selected.headerRowIndex, columns }
}

export type HistoricColumnCompatibility = 'COMPATIBLE' | 'REVIEW' | 'MISSING'

export type HistoricColumnProfile = {
  examples: string[]
  values: string[]
  total: number
  numeric1to4Count: number
  isoDateCount: number
  measureStatusCount: number
  strategyCount: number
}

const MEASURE_STATUSES = ['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE']
const STRATEGIES = ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER']
const isIsoDate = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf())) || /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(value)

/** Profil compact d'une colonne : exemples et compteurs, sans renvoyer le classeur complet au navigateur. */
export function profileHistoricColumn(values: string[]): HistoricColumnProfile {
  const populated = values.map(value => value.trim()).filter(Boolean)
  const normalized = populated.map(value => normalise(value).replace(/ /g, '_').toUpperCase())
  return {
    examples: [...new Set(populated)].slice(0, 3),
    values: [...new Set(populated)].slice(0, 100),
    total: populated.length,
    numeric1to4Count: populated.filter(value => /^[1-4]$/.test(value)).length,
    isoDateCount: populated.filter(isIsoDate).length,
    measureStatusCount: normalized.filter(value => MEASURE_STATUSES.includes(value)).length,
    strategyCount: normalized.filter(value => STRATEGIES.includes(value)).length,
  }
}

export type HistoricColumnProfileValidation = { expected: string; total: number; invalidCount: number }

/** Vérifie les formats métier contrôlables avant l'import et explique l'attendu. */
export function validateHistoricColumnProfile(field: string, profile: HistoricColumnProfile, valueMapping?: Record<string, string>): HistoricColumnProfileValidation {
  if (field === 'gravity' || field === 'likelihood') {
    if (valueMapping) { const invalid = profile.values.some(value => !/^[1-4]$/.test(value) && !/^[1-4]$/.test(valueMapping[value] ?? '')); return { expected: '1–4', total: profile.total, invalidCount: invalid ? 1 : 0 } }
    return { expected: '1–4', total: profile.total, invalidCount: profile.total - profile.numeric1to4Count }
  }
  if (field === 'dueDate') return { expected: 'YYYY-MM-DD ou JJ/MM/AAAA', total: profile.total, invalidCount: profile.total - profile.isoDateCount }
  if (field === 'status') { const mapped = profile.values.filter(value => valueMapping?.[value] || MEASURE_STATUSES.includes(normalise(value).replace(/ /g, '_').toUpperCase())).length; return { expected: MEASURE_STATUSES.join(' | '), total: profile.total, invalidCount: profile.total - mapped } }
  if (field === 'strategy') return { expected: STRATEGIES.join(' | '), total: profile.total, invalidCount: profile.total - profile.strategyCount }
  return { expected: 'texte', total: profile.total, invalidCount: 0 }
}

/** Indique si l'en-tête de la feuille semble correspondre au champ ACRA choisi. */
export function getHistoricColumnCompatibility(field: string, column: string | undefined, required = false): HistoricColumnCompatibility {
  if (!column?.trim()) return required ? 'MISSING' : 'REVIEW'
  const normalized = normalise(column)
  return (COLUMN_ALIASES[field] ?? []).some(alias => normalized.includes(alias)) ? 'COMPATIBLE' : 'REVIEW'
}

export type HistoricImportSelection = { name: string; type: HistoricSheetType; mapping: HistoricColumnMapping; profiles?: Record<string, HistoricColumnProfile>; statusMapping?: Record<string, string> }
export type HistoricImportBlocker = { sheetName: string; field: string }

/** Les formats métier invalides sont bloquants avant toute écriture en base. */
export function validateHistoricImportFormats(sheets: HistoricImportSelection[]): HistoricImportBlocker[] {
  return sheets.flatMap(sheet => Object.entries(sheet.mapping).flatMap(([field, column]) => {
    const profile = column ? sheet.profiles?.[column] : undefined
    // Un statut source sans équivalent n'empêche pas l'import : seules les
    // valeurs explicitement rapprochées sont transformées, les autres gardent
    // le comportement par défaut de la mesure.
    return field !== 'status' && profile && validateHistoricColumnProfile(field, profile).invalidCount > 0 ? [{ sheetName: sheet.name, field }] : []
  }))
}

/**
 * Vérifie les prérequis du sous-ensemble choisi. Un registre de risques seul
 * reste volontairement valide : ACRA crée alors l'analyse à partir du fichier.
 */
export function validateHistoricImportSelection(sheets: HistoricImportSelection[]): HistoricImportBlocker[] {
  const active = sheets.filter(sheet => sheet.type !== 'UNKNOWN')
  const blockers: HistoricImportBlocker[] = []
  const addMissing = (sheet: HistoricImportSelection, field: string) => {
    if (!sheet.mapping[field]?.trim() && !blockers.some(blocker => blocker.sheetName === sheet.name && blocker.field === field)) blockers.push({ sheetName: sheet.name, field })
  }
  for (const sheet of active) for (const field of validateHistoricColumnMapping(sheet.type, sheet.mapping)) addMissing(sheet, field)
  const risks = active.filter(sheet => sheet.type === 'RISKS')
  const actions = active.filter(sheet => sheet.type === 'ACTIONS')
  const requireAny = (candidates: HistoricImportSelection[], field: string, fallbackType: HistoricSheetType) => {
    if (candidates.some(sheet => sheet.mapping[field]?.trim())) return
    const target = candidates[0] ?? active.find(sheet => sheet.type === fallbackType)
    if (target) addMissing(target, field)
  }
  const needsRiskSheet = active.some(sheet => sheet.type === 'VULNERABILITIES' || sheet.type === 'RISK_ACTION_LINKS' || (sheet.type === 'MEASURES' || sheet.type === 'ACTIONS') && Boolean(sheet.mapping.riskExternalId) || sheet.type === 'RISKS' && Boolean(sheet.mapping.embeddedVulnerabilities || sheet.mapping.embeddedActions))
  if (needsRiskSheet && risks.length === 0) blockers.push({ sheetName: active[0]?.name ?? '', field: '__RISK_SHEET__' })
  else if (needsRiskSheet) requireAny(risks, 'externalId', 'RISKS')
  const needsActionSheet = active.some(sheet => sheet.type === 'RISK_ACTION_LINKS')
  if (needsActionSheet && actions.length === 0) blockers.push({ sheetName: active[0]?.name ?? '', field: '__ACTION_SHEET__' })
  else if (needsActionSheet) requireAny(actions, 'externalId', 'ACTIONS')
  return blockers
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
export type HistoricImportSheet = { name?: string; type: HistoricSheetType; mapping: HistoricColumnMapping; transforms?: HistoricFieldTransforms; statusMapping?: Record<string, string>; scoreMappings?: Record<string, Record<string, string>>; rows: HistoricImportRow[]; rowNumbers?: number[] }
export type HistoricImportPackage = {
  analysis: { title: string; description?: string }
  risks: Array<{ externalId?: string; title: string; description?: string; gravity?: number; likelihood?: number; strategy?: string }>
  vulnerabilities: Array<{ riskExternalId: string; title: string; description?: string }>
  measures: Array<{ externalId?: string; riskExternalId?: string; title: string; description?: string; status?: string; responsible?: string; dueDate?: string }>
  actions: Array<{ externalId?: string; riskExternalId?: string; title: string; description?: string; responsible?: string; dueDate?: string }>
  links: Array<{ riskExternalId: string; actionExternalId: string }>
}

const text = (row: HistoricImportRow, column: string | undefined): string | undefined => {
  const value = splitHistoricMappedColumns(column).map(name => row[name]?.trim()).filter(Boolean).join('\n\n')
  return value || undefined
}
const stripListMarker = (value: string) => value.replace(/^\s*(?:[•·▪◦*\-–—]+|\d+[.)])\s*/, '').trim()

/** Lit une cellule comme une valeur unique par défaut, ou comme une liste après choix explicite dans l'assistant. */
export function extractHistoricMappedValues(row: HistoricImportRow, column: string | undefined, transform?: HistoricValueTransform): string[] {
  const value = text(row, column)
  if (!value) return []
  if (!transform?.mode) return [value]
  const separator = transform.mode === 'LINES' ? /\r?\n/ : transform.mode === 'SEMICOLON' ? /;/ : /\|/
  return value.split(separator).map(stripListMarker).filter(Boolean)
}
const values = (row: HistoricImportRow, sheet: HistoricImportSheet, field: string) => extractHistoricMappedValues(row, sheet.mapping[field], sheet.transforms?.[field])
const first = (row: HistoricImportRow, sheet: HistoricImportSheet, field: string) => values(row, sheet, field)[0]
const descriptionText = (row: HistoricImportRow, column: string | undefined): string | undefined => {
  const value = splitHistoricMappedColumns(column).map(name => {
    const content = row[name]?.trim()
    return content ? `${name}: ${content}` : undefined
  }).filter(Boolean).join('\n\n')
  return value || undefined
}
/** Accepte les dates ISO et les formats consultant français courants avant écriture. */
const dateText = (row: HistoricImportRow, column: string | undefined): string | undefined => {
  const raw = text(row, column)
  if (!raw) return undefined
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return raw
}
const score = (row: HistoricImportRow, column: string | undefined, valueMapping?: Record<string, string>): number | undefined => {
  const raw = text(row, column)
  const value = Number(raw && (valueMapping?.[raw] ?? raw))
  return Number.isFinite(value) && value >= 1 && value <= 4 ? Math.round(value) : undefined
}

export type HistoricImportDecision = { sheetName: string; row: number; status: 'READY' | 'FIELD_OMITTED' | 'REJECTED'; field?: string; reason?: 'MISSING_REQUIRED_VALUE' | 'INVALID_FORMAT' | 'CARDINALITY_MISMATCH'; sourceColumn?: string; sourceValue?: string; expectedValue?: string }
export type HistoricImportPartition = { sheets: HistoricImportSheet[]; decisions: HistoricImportDecision[] }
/** Valeurs ajoutées explicitement par l'utilisateur pour une cellule requise vide. */
export type HistoricRowOverrides = Record<string, Record<string, Record<string, string>>>
const requiredRowFields: Partial<Record<HistoricSheetType, string[]>> = {
  ANALYSES: ['title'], RISKS: ['title'], VULNERABILITIES: ['riskExternalId', 'title'], MEASURES: ['title'], ACTIONS: ['title'], RISK_ACTION_LINKS: ['riskExternalId', 'actionExternalId'],
}
const expectedRequiredValue = (field: string) => field.endsWith('ExternalId') ? 'référence non vide' : 'texte non vide'
const invalidFormat = (field: string, value: string, statusMapping?: Record<string, string>) => {
  if (field === 'gravity' || field === 'likelihood') return !/^[1-4]$/.test(value)
  if (field === 'dueDate') return !isIsoDate(value)
  if (field === 'strategy') return !STRATEGIES.includes(normalise(value).replace(/ /g, '_').toUpperCase())
  if (field === 'status') return !MEASURE_STATUSES.includes(normalise(value).replace(/ /g, '_').toUpperCase()) && !statusMapping?.[value]
  return false
}

/**
 * Applique les seules corrections déclarées dans l'étape de revue. Un correctif
 * ne peut viser qu'un champ requis réellement mappé : le client ne peut donc ni
 * enrichir silencieusement des champs facultatifs, ni modifier une autre ligne.
 */
export function applyHistoricRowOverrides(sheets: HistoricImportSheet[], overrides: HistoricRowOverrides): HistoricImportSheet[] {
  return sheets.map(sheet => ({ ...sheet, rows: sheet.rows.map((original, index) => {
    const sourceRow = String(sheet.rowNumbers?.[index] ?? index + 2)
    const corrections = overrides[sheet.name ?? '']?.[sourceRow]
    if (!corrections) return original
    const row = { ...original }
    for (const field of requiredRowFields[sheet.type] ?? []) {
      const value = corrections[field]?.trim()
      const targetColumn = splitHistoricMappedColumns(sheet.mapping[field])[0]
      if (value && targetColumn) row[targetColumn] = value
    }
    return row
  }) }))
}

/**
 * Prépare le plus grand sous-ensemble importable : une absence de valeur requise
 * rejette uniquement sa ligne ; un format invalide dans un champ facultatif est
 * retiré de l'objet et reste consigné dans le rapport de décision.
 */
export function partitionHistoricImportSheets(sheets: HistoricImportSheet[]): HistoricImportPartition {
  const decisions: HistoricImportDecision[] = []
  const partitioned = sheets.map(sheet => {
    const rows: HistoricImportRow[] = []
    const rowNumbers: number[] = []
    const carriedColumns = Object.entries(sheet.transforms ?? {}).flatMap(([field, transform]) => transform?.carryForward ? splitHistoricMappedColumns(sheet.mapping[field]) : [])
    const lastValues = new Map<string, string>()
    const preparedRows = sheet.rows.map(original => {
      const row = { ...original }
      for (const column of carriedColumns) {
        const current = row[column]?.trim()
        if (current) lastValues.set(column, current)
        else if (lastValues.has(column)) row[column] = lastValues.get(column)!
      }
      return row
    })
    preparedRows.forEach((original, index) => {
      const row = { ...original }
      const sourceRow = sheet.rowNumbers?.[index] ?? index + 2
      const missing = (requiredRowFields[sheet.type] ?? []).filter(field => values(row, sheet, field).length === 0)
      if (missing.length) { for (const field of missing) {
        const sourceColumn = sheet.mapping[field]
        const sourceValue = splitHistoricMappedColumns(sourceColumn).map(column => row[column]?.trim() ?? '').join(' | ')
        decisions.push({ sheetName: sheet.name ?? '', row: sourceRow, status: 'REJECTED', field, reason: 'MISSING_REQUIRED_VALUE', sourceColumn, sourceValue, expectedValue: expectedRequiredValue(field) })
      } return }
      if (sheet.type === 'RISK_ACTION_LINKS') {
        const riskReferences = values(row, sheet, 'riskExternalId')
        const actionReferences = values(row, sheet, 'actionExternalId')
        if (riskReferences.length > 1 && actionReferences.length > 1 && riskReferences.length !== actionReferences.length) {
          decisions.push({ sheetName: sheet.name ?? '', row: sourceRow, status: 'REJECTED', reason: 'CARDINALITY_MISMATCH' }); return
        }
      }
      for (const [field, column] of Object.entries(sheet.mapping)) {
        const value = text(row, column)
        if (!value || !invalidFormat(field, value, sheet.statusMapping)) continue
        for (const sourceColumn of splitHistoricMappedColumns(column)) row[sourceColumn] = ''
        decisions.push({ sheetName: sheet.name ?? '', row: sourceRow, status: 'FIELD_OMITTED', field, reason: 'INVALID_FORMAT' })
      }
      rows.push(row); rowNumbers.push(sourceRow)
      decisions.push({ sheetName: sheet.name ?? '', row: sourceRow, status: 'READY' })
    })
    return { ...sheet, rows, rowNumbers }
  })
  return { sheets: partitioned, decisions }
}

/** Transforme des lignes Excel déjà mappées en contrat d'import explicite, sans I/O ni écriture. */
export function buildHistoricImportPackage(sheets: HistoricImportSheet[], fallbackTitle: string): HistoricImportPackage {
  const result: HistoricImportPackage = { analysis: { title: fallbackTitle.slice(0, 200) || 'Analyse importée' }, risks: [], vulnerabilities: [], measures: [], actions: [], links: [] }
  for (const sheet of sheets) for (const row of sheet.rows) {
    const title = first(row, sheet, 'title')
    if (sheet.type === 'ANALYSES' && title && result.analysis.title === fallbackTitle) {
      result.analysis = { title: title.slice(0, 200), description: descriptionText(row, sheet.mapping.description)?.slice(0, 2000) }
    }
    if (sheet.type === 'RISKS' && title) {
      const externalId = text(row, sheet.mapping.externalId)
      result.risks.push({ externalId, title: title.slice(0, 255), description: descriptionText(row, sheet.mapping.description)?.slice(0, 2000), gravity: score(row, sheet.mapping.gravity, sheet.scoreMappings?.gravity), likelihood: score(row, sheet.mapping.likelihood, sheet.scoreMappings?.likelihood), strategy: text(row, sheet.mapping.strategy) })
      if (externalId) {
        for (const vulnerabilityTitle of values(row, sheet, 'embeddedVulnerabilities')) result.vulnerabilities.push({ riskExternalId: externalId, title: vulnerabilityTitle.slice(0, 500) })
        for (const actionTitle of values(row, sheet, 'embeddedActions')) result.actions.push({ riskExternalId: externalId, title: actionTitle.slice(0, 255) })
      }
    }
    if (sheet.type === 'VULNERABILITIES') {
      const riskExternalId = first(row, sheet, 'riskExternalId')
      if (riskExternalId) for (const vulnerabilityTitle of values(row, sheet, 'title')) result.vulnerabilities.push({ riskExternalId, title: vulnerabilityTitle.slice(0, 500), description: descriptionText(row, sheet.mapping.description)?.slice(0, 2000) })
    }
    if (sheet.type === 'MEASURES') { const rawStatus = first(row, sheet, 'status'); const titles = values(row, sheet, 'title'); for (const measureTitle of titles) result.measures.push({ externalId: titles.length === 1 ? first(row, sheet, 'externalId') : undefined, riskExternalId: first(row, sheet, 'riskExternalId'), title: measureTitle.slice(0, 255), description: descriptionText(row, sheet.mapping.description)?.slice(0, 2000), status: rawStatus ? sheet.statusMapping?.[rawStatus] ?? rawStatus : undefined, responsible: first(row, sheet, 'responsible'), dueDate: dateText(row, sheet.mapping.dueDate) }) }
    if (sheet.type === 'ACTIONS') { const titles = values(row, sheet, 'title'); for (const actionTitle of titles) result.actions.push({ externalId: titles.length === 1 ? first(row, sheet, 'externalId') : undefined, riskExternalId: first(row, sheet, 'riskExternalId'), title: actionTitle.slice(0, 255), description: descriptionText(row, sheet.mapping.description)?.slice(0, 2000), responsible: first(row, sheet, 'responsible'), dueDate: dateText(row, sheet.mapping.dueDate) }) }
    if (sheet.type === 'RISK_ACTION_LINKS') {
      const riskReferences = values(row, sheet, 'riskExternalId')
      const actionReferences = values(row, sheet, 'actionExternalId')
      if (riskReferences.length === 1) for (const actionExternalId of actionReferences) result.links.push({ riskExternalId: riskReferences[0], actionExternalId })
      else if (actionReferences.length === 1) for (const riskExternalId of riskReferences) result.links.push({ riskExternalId, actionExternalId: actionReferences[0] })
      else if (riskReferences.length === actionReferences.length) riskReferences.forEach((riskExternalId, index) => result.links.push({ riskExternalId, actionExternalId: actionReferences[index] }))
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
