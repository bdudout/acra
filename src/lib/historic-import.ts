import { parseLevelLabel, isTemplateRow, extractReferences, aliasPrefix, canonicalRef, prefixesOfRefs } from './import-transforms'
import { ATELIER_REQUIRED, ATELIER_ROLES, buildAtelierContent, detectAtelierRole, type AtelierRole, type AtelierSheet, type AtelierValueMaps } from './import-ateliers-build'
import type { AtelierContent } from './analysis-import-ateliers'
import { buildContextFromBlocks, type KeyValue, type TextBlock } from './excel-blocks'
/** Reconnaissance pure et prudente des feuilles historiques avant mapping humain. */
export const HISTORIC_SHEET_TYPES = ['ANALYSES', 'RISKS', 'VULNERABILITIES', 'MEASURES', 'ACTIONS', 'RISK_ACTION_LINKS', ...ATELIER_ROLES, 'CONTEXT', 'UNKNOWN'] as const
export type HistoricSheetType = (typeof HISTORIC_SHEET_TYPES)[number]
export const isAtelierRole = (type: HistoricSheetType): type is AtelierRole => (ATELIER_ROLES as readonly string[]).includes(type)
export type HistoricSheetDetection = { type: HistoricSheetType; confidence: 'HIGH' | 'MEDIUM' | 'NONE'; missing: string[] }

/** La détection est une suggestion : le rôle choisi dans l'assistant prévaut. */
export function resolveHistoricImportSheetType(detected: HistoricSheetType, selected?: HistoricSheetType): HistoricSheetType {
  return selected ?? detected
}

function normalise(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

const matches = (values: string[], terms: string[]) => terms.some(term => values.some(value => value.includes(term)))

// Un « titre de risque » : la colonne identifie le risque lui-même (et non une source de risque, un niveau de risque
// ou un scénario). Évite de classer en « Risques » des feuilles d'échelles ou de scénarios EBIOS RM (lot I1, B-IMP-13).
const RISK_WORD = '(risques?|risks?|risiko|risiken|riesgos?|rischio|rischi)'
const RISK_TITLE = new RegExp(`^(ref |id |reference |numero )?(du |de |des )?${RISK_WORD}( id| label| title| name| ref)?$|^(libelle|intitule|description|nom|titre|designation|bezeichnung|beschreibung|descripcion|descrizione|title) (du |de |des |d |des |del |della |dei )?${RISK_WORD}$|^${RISK_WORD} (id|label|title|name|description)$|^(ref|reference|id|numero) (du |de |des )?${RISK_WORD}$`)
const RISK_SHEET_NAME = new RegExp(`^(\\d+ ?[-.] ?)?(registre |liste |tableau |register |risikoregister |registro )?(des |de |del |dei )?${RISK_WORD}( .*)?$`)
const SCALE_HEADER = /^(echelle|description des niveaux|definition des|definition du|calcul d)/

/** Feuille d'échelles / tables de calcul (niveau, définition…) : jamais un registre de risques. */
function looksLikeScaleSheet(name: string, columns: string[]): boolean {
  return name.includes('metrique') || /^echelles?( |$)/.test(name) || columns.filter(c => SCALE_HEADER.test(c)).length >= 2
}

export function detectHistoricImportSheet(name: string, columns: string[]): HistoricSheetDetection {
  // Feuilles des ateliers 1 à 4 (Réf.VM, Réf.ER, Réf.PP, Réf.SS…) : reconnues par leur colonne de référence à préfixe.
  const atelier = detectAtelierRole(name, columns)
  if (atelier) return atelier
  const cols = columns.map(normalise)
  const nameN = normalise(name)
  const haystack = [nameN, ...cols]
  if (looksLikeScaleSheet(nameN, cols)) return { type: 'UNKNOWN', confidence: 'NONE', missing: [] }
  if (matches(haystack, ['vulnerabilite', 'vulnerability']) && matches(haystack, ['risque', 'risk'])) return { type: 'VULNERABILITIES', confidence: 'HIGH', missing: [] }
  const riskIdentified = cols.some(c => RISK_TITLE.test(c)) || (RISK_SHEET_NAME.test(nameN) && !cols.some(c => c.includes('scenario')))
  if (riskIdentified && matches(haystack, ['gravite', 'impact', 'vraisemblance', 'probabilite', 'likelihood', 'auswirkung', 'wahrscheinlichkeit', 'gravedad', 'impacto', 'probabilidad', 'gravita', 'impatto'])) return { type: 'RISKS', confidence: 'HIGH', missing: [] }
  // Registre générique d'un autre outil : un intitulé + une gravité/impact + une vraisemblance/probabilité suffisent (confiance moyenne).
  const hasGenericTitle = cols.some(c => /^(libelle|intitule|titre|nom|title|name|label|description)$/.test(c))
  if (hasGenericTitle && matches(cols, ['gravite', 'impact', 'severity', 'auswirkung', 'gravedad', 'gravita']) && matches(cols, ['vraisemblance', 'probabilite', 'likelihood', 'probability', 'wahrscheinlichkeit', 'probabilidad', 'probabilita'])) return { type: 'RISKS', confidence: 'MEDIUM', missing: [] }
  if (/(controle|control|mesure|measure)s?( |$)/.test(nameN.split('.').pop() ?? nameN) && cols.some(c => /^(libelle|intitule|titre|nom|title|name|label)$/.test(c))) return { type: 'MEASURES', confidence: 'MEDIUM', missing: [] }
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
    ...ATELIER_REQUIRED,
  }
  return (required[type] ?? []).filter(key => !mapping[key]?.trim())
}

/** Alias « =mot » : le nom de colonne doit être EXACTEMENT ce mot ; sinon il suffit qu'il le contienne. */
const aliasMatches = (normalizedColumn: string, alias: string) => (alias.startsWith('=') ? normalizedColumn === alias.slice(1) : normalizedColumn.includes(alias))

const COLUMN_ALIASES: Record<string, string[]> = {
  externalId: ['=id', '=ref', '=code', '=numero', '=key', 'reference', 'ref', 'id externe', 'external id', 'risk id', 'action id', 'referenz', 'referencia', 'riferimento'],
  title: ['=risque', '=risk', '=risiko', '=riesgo', '=rischio', 'description courte', 'short description', 'kurzbeschreibung', 'descripcion corta', 'descrizione breve', 'libelle de risque', 'risk label', 'intitule', 'titre', 'nom', 'libelle', 'title', 'bezeichnung', 'titel', 'titulo', 'nombre', 'titolo', 'nome', 'description du risque', 'libelle du risque', 'intitule du risque', 'nom du risque', 'risk name', 'risk title', 'risk description'],
  gravity: ['gravite', 'severity', 'impact', 'schweregrad', 'auswirkung', 'gravedad', 'impacto', 'gravita', 'impatto'],
  likelihood: ['vraisemblance', 'probabilite', 'likelihood', 'probability', 'wahrscheinlichkeit', 'probabilidad', 'probabilita'],
  description: ['description', 'detail', 'commentaire', 'beschreibung', 'descripcion', 'descrizione', 'comment'],
  strategy: ['strategie', 'traitement', 'treatment', 'strategy', 'behandlung', 'tratamiento', 'trattamento'],
  status: ['statut', 'etat', 'status', 'state', 'estado', 'stato', 'zustand'],
  responsible: ['responsable', 'porteur', 'owner', 'responsible', 'verantwortlich', 'responsabile'],
  dueDate: ['echeance', 'date de mise en oeuvre', 'date de mise en uvre', 'mise en oeuvre le', 'implementation date', 'date cible', 'due date', 'deadline', 'frist', 'falligkeit', 'vencimiento', 'fecha limite', 'scadenza'],
  riskExternalId: ['risques initiaux concernes', 'risques concernes', 'risque concerne', 'affected risk', 'reference risque', 'risque id', 'risk id', 'risk reference', 'risiko id', 'riesgo id'],
  actionExternalId: ['reference action', 'action id', 'action reference'],
  analysisExternalId: ['reference analyse', 'analyse id', 'analyse external id', 'analysis id', 'analysis external id', 'analysis reference'],
}

const HEADER_CELL_MAX = 60
const ALIAS_PATTERNS = Object.values(COLUMN_ALIASES).flat().map(alias => new RegExp(`(^| )${alias}s?( |$)`))

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
    // Une cellule d'en-tête est COURTE (un paragraphe de texte libre n'en est pas une) et un alias s'y lit comme
    // mot entier — « nom » ne doit pas se reconnaître dans « économiques » (lot I1, B-IMP-11).
    const aliasMatches = nonEmpty.filter(value => {
      if (value.length > HEADER_CELL_MAX) return false
      const normalized = normalise(value)
      return ALIAS_PATTERNS.some(pattern => pattern.test(normalized))
    }).length
    return { headerRowIndex, values, score: nonEmpty.length >= 2 ? aliasMatches * 10 + Math.min(nonEmpty.length, 8) : -1 }
  })
  const selected = candidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best, candidates[0] ?? { headerRowIndex: 0, values: [], score: -1 })
  // En-tête sur deux niveaux : un bandeau (« Besoins de sécurité ») au-dessus de sous-en-têtes fusionnés horizontalement.
  const sub = subHeaderRow(rows, selected.headerRowIndex, selected.values)
  const values = sub ? composeHeaderLabels(selected.values, sub) : selected.values
  const headerRowIndex = sub ? selected.headerRowIndex + 1 : selected.headerRowIndex
  const seen = new Map<string, number>()
  const columns = values.flatMap((label, index) => {
    if (!label) return []
    const occurrence = seen.get(label) ?? 0
    seen.set(label, occurrence + 1)
    return [{ key: occurrence === 0 ? label : `${label} [${spreadsheetColumn(index)}]`, label, index }]
  })
  return { headerRowIndex, columns }
}

const HEADER_SEPARATOR = ' › '
// Une cellule de donnée ressemble à une référence (VM_01, R-1, ER03) ou à un nombre / niveau : jamais à un sous-en-tête.
const DATA_LIKE = /^([A-Za-z]{1,6}[/._ -]?\d+[A-Za-z]?|\d+([.,]\d+)?( ?[-–] .+)?|[+\s]+)$/

/**
 * Ligne de sous-en-têtes sous la ligne d'en-tête retenue : au moins deux cellules courtes, aucune ne ressemblant à une
 * donnée, et au moins une placée sous une cellule vide du bandeau (cellule fusionnée horizontalement).
 */
function subHeaderRow(rows: string[][], headerIndex: number, header: string[]): string[] | null {
  const next = rows[headerIndex + 1]?.map(value => value.trim())
  if (!next) return null
  const filled = next.map((value, index) => ({ value, index })).filter(cell => cell.value)
  if (filled.length < 2) return null
  if (filled.some(cell => cell.value.length > HEADER_CELL_MAX || DATA_LIKE.test(cell.value))) return null
  const underBand = filled.some(cell => !header[cell.index]?.trim())
  const bandBefore = filled.some(cell => cell.index > 0 && header.slice(0, cell.index).some(value => value.trim()))
  return underBand && bandBefore ? next : null
}

function composeHeaderLabels(header: string[], sub: string[]): string[] {
  const out: string[] = []
  let band = ''
  const length = Math.max(header.length, sub.length)
  for (let index = 0; index < length; index++) {
    const top = header[index]?.trim() ?? ''
    const low = sub[index]?.trim() ?? ''
    if (top) band = low ? top : ''
    if (top && low) { band = top; out.push(`${top}${HEADER_SEPARATOR}${low}`); continue }
    if (top && !low) { band = top; out.push(top); continue }
    out.push(low && band ? `${band}${HEADER_SEPARATOR}${low}` : low)
  }
  return out
}

export type HistoricColumnCompatibility = 'COMPATIBLE' | 'REVIEW' | 'MISSING'

export type HistoricColumnProfile = {
  examples: string[]
  values: string[]
  total: number
  /** Nombre de valeurs distinctes (pour repérer une vraie colonne de référence : valeurs uniques). */
  distinct?: number
  numeric1to4Count: number
  isoDateCount: number
  measureStatusCount: number
  strategyCount: number
}

/** Niveau 1–4, nu (« 3 ») ou avec son libellé (« 3 - Elevé ») : lot I3, B-IMP-28. */
const isLevel1to4 = (value: string) => { const l = parseLevelLabel(value); return !!l && l.level >= 1 && l.level <= 4 }

const MEASURE_STATUSES = ['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE']
const STATUS_SYNONYMS: Record<string, string> = {
  REALISE: 'REALISE', REALISEE: 'REALISE', TERMINE: 'REALISE', TERMINEE: 'REALISE', FAIT: 'REALISE', FAITE: 'REALISE', CLOTURE: 'REALISE', CLOTUREE: 'REALISE', DONE: 'REALISE', CLOSED: 'REALISE', COMPLETED: 'REALISE', COMPLETE: 'REALISE',
  A_FAIRE: 'A_FAIRE', A_REALISER: 'A_FAIRE', PLANIFIE: 'A_FAIRE', PLANIFIEE: 'A_FAIRE', NON_DEMARRE: 'A_FAIRE', NON_DEMARREE: 'A_FAIRE', TO_DO: 'A_FAIRE', TODO: 'A_FAIRE', OPEN: 'A_FAIRE', PLANNED: 'A_FAIRE', NOT_STARTED: 'A_FAIRE',
  EN_COURS: 'EN_COURS', IN_PROGRESS: 'EN_COURS', ONGOING: 'EN_COURS', DEMARRE: 'EN_COURS', DEMARREE: 'EN_COURS',
  REPORTE: 'REPORTE', REPORTEE: 'REPORTE', ABANDONNE: 'REPORTE', ABANDONNE_SUSPENDU: 'REPORTE', SUSPENDU: 'REPORTE', SUSPENDUE: 'REPORTE', POSTPONED: 'REPORTE', ON_HOLD: 'REPORTE', CANCELLED: 'REPORTE',
}
const GRAVITY_WORDS: Record<string, number> = {
  negligeable: 1, mineure: 1, mineur: 1, faible: 1, minime: 1, limitee: 2, limite: 2, moyenne: 2, moyen: 2, moderee: 2, significative: 2, importante: 3, important: 3, grave: 3, forte: 3, fort: 3, elevee: 3, majeure: 3, critique: 4, maximale: 4, catastrophique: 4,
}
const LIKELIHOOD_WORDS: Record<string, number> = {
  improbable: 1, rare: 1, 'peu vraisemblable': 1, minime: 1, unlikely: 1, possible: 2, vraisemblable: 2, moderee: 2, significative: 2, probable: 3, 'tres vraisemblable': 3, forte: 3, likely: 3, 'quasi certaine': 4, 'quasi certain': 4, certaine: 4, certain: 4, maximale: 4,
}
/**
 * Proposition (modifiable) de niveaux 1–4 pour une cotation en clair (« Critique », « Vraisemblable »…).
 * Seules les valeurs RECONNUES sont proposées : une valeur inconnue (hors échelle) reste sans niveau et signalée, jamais devinée.
 * `null` si la colonne est numérique ou si aucune valeur n'est reconnue.
 */
export function suggestScoreMapping(field: 'gravity' | 'likelihood', values: string[]): Record<string, string> | null {
  const table = field === 'gravity' ? GRAVITY_WORDS : LIKELIHOOD_WORDS
  const distinct = [...new Set(values.map(v => v.trim()).filter(Boolean))]
  if (distinct.length === 0 || distinct.some(v => isLevel1to4(v))) return null
  const out: Record<string, string> = {}
  for (const v of distinct) { const level = table[normalise(v)]; if (level) out[v] = String(level) }
  return Object.keys(out).length ? out : null
}

/** Statut de mesure ACRA d'après un libellé courant (FR/EN) ; `null` si le libellé n'est pas reconnu (jamais inventé). */
export function normalizeMeasureStatus(raw: string): string | null {
  const key = normalise(raw).replace(/ /g, '_').toUpperCase()
  return STATUS_SYNONYMS[key] ?? null
}
const STRATEGIES = ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER']
const STRATEGY_SYNONYMS: Record<string, string> = {
  REDUIRE: 'REDUIRE', REDUCTION: 'REDUIRE', REDUCE: 'REDUIRE', MITIGATE: 'REDUIRE', MITIGATION: 'REDUIRE',
  ACCEPTER: 'ACCEPTER', ACCEPTATION: 'ACCEPTER', ACCEPTE: 'ACCEPTER', ACCEPTEE: 'ACCEPTER', ACCEPT: 'ACCEPTER', ACCEPTED: 'ACCEPTER',
  TRANSFERER: 'TRANSFERER', TRANSFERT: 'TRANSFERER', PARTAGE: 'TRANSFERER', PARTAGER: 'TRANSFERER', SHARE: 'TRANSFERER', SHARING: 'TRANSFERER', TRANSFERE: 'TRANSFERER', TRANSFER: 'TRANSFERER',
  REFUSER: 'REFUSER', REFUS: 'REFUSER', EVITER: 'REFUSER', EVITEMENT: 'REFUSER', AVOID: 'REFUSER', AVOIDANCE: 'REFUSER',
  SURVEILLER: 'SURVEILLER', SURVEILLANCE: 'SURVEILLER', MONITOR: 'SURVEILLER', MONITORING: 'SURVEILLER',
}
/** Stratégie de traitement ACRA d'après un libellé courant (FR/EN) ; `null` si non reconnu (jamais inventé). */
export function normalizeStrategy(raw: string): string | null {
  return STRATEGY_SYNONYMS[normalise(raw).replace(/ /g, '_').toUpperCase()] ?? null
}
const isIsoDate = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf())) || /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(value)

/** Profil compact d'une colonne : exemples et compteurs, sans renvoyer le classeur complet au navigateur. */
export function profileHistoricColumn(values: string[]): HistoricColumnProfile {
  const populated = values.map(value => value.trim()).filter(Boolean)
  const normalized = populated.map(value => normalise(value).replace(/ /g, '_').toUpperCase())
  return {
    examples: [...new Set(populated)].slice(0, 3),
    values: [...new Set(populated)].slice(0, 100),
    total: populated.length,
    distinct: new Set(populated).size,
    numeric1to4Count: populated.filter(isLevel1to4).length,
    isoDateCount: populated.filter(isIsoDate).length,
    measureStatusCount: populated.filter(value => normalizeMeasureStatus(value)).length,
    strategyCount: populated.filter(value => normalizeStrategy(value)).length,
  }
}

export type HistoricColumnProfileValidation = { expected: string; total: number; invalidCount: number }

/** Vérifie les formats métier contrôlables avant l'import et explique l'attendu. */
export function validateHistoricColumnProfile(field: string, profile: HistoricColumnProfile, valueMapping?: Record<string, string>): HistoricColumnProfileValidation {
  if (field === 'gravity' || field === 'likelihood') {
    if (valueMapping) { const invalid = profile.values.some(value => !isLevel1to4(value) && !/^[1-4]$/.test(valueMapping[value] ?? '')); return { expected: '1–4', total: profile.total, invalidCount: invalid ? 1 : 0 } }
    return { expected: '1–4', total: profile.total, invalidCount: profile.total - profile.numeric1to4Count }
  }
  if (field === 'dueDate') return { expected: 'YYYY-MM-DD ou JJ/MM/AAAA', total: profile.total, invalidCount: profile.total - profile.isoDateCount }
  if (field === 'status') { const mapped = profile.values.filter(value => valueMapping?.[value] || normalizeMeasureStatus(value)).length; return { expected: MEASURE_STATUSES.join(' | '), total: profile.total, invalidCount: profile.total - mapped } }
  if (field === 'strategy') return { expected: STRATEGIES.join(' | '), total: profile.total, invalidCount: profile.total - profile.strategyCount }
  return { expected: 'texte', total: profile.total, invalidCount: 0 }
}

/** Indique si l'en-tête de la feuille semble correspondre au champ ACRA choisi. */
export function getHistoricColumnCompatibility(field: string, column: string | undefined, required = false): HistoricColumnCompatibility {
  if (!column?.trim()) return required ? 'MISSING' : 'REVIEW'
  const normalized = normalise(column)
  return (COLUMN_ALIASES[field] ?? []).some(alias => aliasMatches(normalized, alias)) ? 'COMPATIBLE' : 'REVIEW'
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

/**
 * Une colonne « Réf. » dont les valeurs se répètent est un regroupement (catégorie), pas une référence : on lui préfère une
 * autre colonne d'intitulé voisin dont les valeurs sont toutes uniques. Sans candidate unique, la suggestion est conservée.
 */
export function refineReferenceMapping(mapping: HistoricColumnMapping, header: string[], profiles: Record<string, HistoricColumnProfile | undefined>): HistoricColumnMapping {
  const current = mapping.externalId
  const unique = (column: string) => { const p = profiles[column]; return !!p && p.total > 0 && (p.distinct ?? p.values.length) === p.total }
  if (!current || unique(current) || !profiles[current]) return mapping
  const aliases = COLUMN_ALIASES.externalId
  const candidate = header.find(column => column !== current && unique(column) && aliases.some(alias => aliasMatches(normalise(column), alias)))
  return candidate ? { ...mapping, externalId: candidate } : mapping
}

/**
 * Feuille enfant issue d'un JSON imbriqué (`registre.controles`) : sa colonne portant le NOM de la feuille des risques est la
 * référence du risque parent. Proposition seulement, jamais d'écrasement d'un mapping déjà présent.
 */
export function linkChildSheetsToRisks<T extends { name: string; detection: { type: HistoricSheetType }; columns: string[]; mapping: HistoricColumnMapping }>(sheets: T[]): T[] {
  const riskSheets = new Set(sheets.filter(sheet => sheet.detection.type === 'RISKS').map(sheet => sheet.name))
  return sheets.map(sheet => {
    if (!['MEASURES', 'ACTIONS', 'VULNERABILITIES'].includes(sheet.detection.type) || sheet.mapping.riskExternalId) return sheet
    const parent = sheet.columns.find(column => riskSheets.has(column))
    return parent ? { ...sheet, mapping: { ...sheet.mapping, riskExternalId: parent } } : sheet
  })
}

/** Suggestions transparentes : le mapping est affiché et reste modifiable avant validation. */
export function suggestHistoricColumnMapping(columns: string[]): HistoricColumnMapping {
  const normalized = columns.map(column => ({ raw: column, value: normalise(column) }))
  const used = new Set<string>()
  // Une colonne n'est proposée que pour UN champ (l'ordre des alias fait la priorité : référence, intitulé, puis le reste).
  return Object.fromEntries(Object.entries(COLUMN_ALIASES).flatMap(([field, aliases]) => {
    const isReference = /ExternalId$/.test(field) // une même colonne de référence peut servir plusieurs rôles (risque, action, analyse)
    const match = normalized.find(column => (isReference || !used.has(column.raw)) && aliases.some(alias => aliasMatches(column.value, alias)))
    if (!match) return []
    if (!isReference) used.add(match.raw)
    return [[field, match.raw]]
  }))
}

export type HistoricImportRow = Record<string, string>
/** Blocs non tabulaires lus pour le rôle « contexte » (périmètre en texte libre, page de garde). */
export type HistoricContextBlocks = { text: TextBlock[]; kv: KeyValue[] }
export type HistoricImportSheet = { valueMaps?: AtelierValueMaps; refAliases?: Record<string, string>; blocks?: HistoricContextBlocks; name?: string; type: HistoricSheetType; mapping: HistoricColumnMapping; transforms?: HistoricFieldTransforms; statusMapping?: Record<string, string>; scoreMappings?: Record<string, Record<string, string>>; rows: HistoricImportRow[]; rowNumbers?: number[] }
export type HistoricImportPackage = {
  analysis: { title: string; description?: string; methode?: 'EBIOS_RM' }
  risks: Array<{ externalId?: string; title: string; description?: string; gravity?: number; likelihood?: number; strategy?: string }>
  vulnerabilities: Array<{ riskExternalId: string; title: string; description?: string }>
  measures: Array<{ externalId?: string; riskExternalId?: string; title: string; description?: string; status?: string; responsible?: string; dueDate?: string }>
  actions: Array<{ externalId?: string; riskExternalId?: string; title: string; description?: string; responsible?: string; dueDate?: string }>
  links: Array<{ riskExternalId: string; actionExternalId: string }>
} & Partial<Omit<AtelierContent, 'context'>> & { context?: AtelierContent['context'] } & {
  /** Textes raccourcis à la construction (ateliers) : signalés au bilan, jamais bloquants. */
  truncated?: { path: string; max: number; length: number }[]
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
  if (!raw) return undefined
  // Correspondance explicite d'abord ; puis « 3 - Elevé » lu comme 3 ; puis nombre nu.
  const mapped = valueMapping?.[raw]
  const level = mapped !== undefined ? Number(mapped) : (parseLevelLabel(raw)?.level ?? Number(raw))
  return Number.isFinite(level) && level >= 1 && level <= 4 ? Math.round(level) : undefined
}

export type HistoricImportDecision = { sheetName: string; row: number; status: 'READY' | 'FIELD_OMITTED' | 'REJECTED' | 'IGNORED'; field?: string; reason?: 'MISSING_REQUIRED_VALUE' | 'INVALID_FORMAT' | 'CARDINALITY_MISMATCH' | 'EMPTY_TEMPLATE_ROW' | 'DUPLICATE_REFERENCE'; sourceColumn?: string; sourceValue?: string; expectedValue?: string }
export type HistoricImportPartition = { sheets: HistoricImportSheet[]; decisions: HistoricImportDecision[] }
/** Valeurs ajoutées explicitement par l'utilisateur pour une cellule requise vide. */
export type HistoricRowOverrides = Record<string, Record<string, Record<string, string>>>
const requiredRowFields: Partial<Record<HistoricSheetType, string[]>> = {
  ANALYSES: ['title'], RISKS: ['title'], VULNERABILITIES: ['riskExternalId', 'title'], MEASURES: ['title'], ACTIONS: ['title'], RISK_ACTION_LINKS: ['riskExternalId', 'actionExternalId'],
  ...ATELIER_REQUIRED,
}
const expectedRequiredValue = (field: string) => field.endsWith('ExternalId') ? 'référence non vide' : 'texte non vide'
const invalidFormat = (field: string, value: string, statusMapping?: Record<string, string>, scoreMapping?: Record<string, string>) => {
  if (field === 'gravity' || field === 'likelihood') return !isLevel1to4(value) && !/^[1-4]$/.test(scoreMapping?.[value] ?? '')
  if (field === 'dueDate') return !isIsoDate(value)
  if (field === 'strategy') return !normalizeStrategy(value)
  if (field === 'status') return !normalizeMeasureStatus(value) && !statusMapping?.[value]
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
const DUPLICATE_CHECKED: HistoricSheetType[] = ['RISKS', 'MEASURES', 'ACTIONS', 'VULNERABILITIES']

export function partitionHistoricImportSheets(sheets: HistoricImportSheet[]): HistoricImportPartition {
  const decisions: HistoricImportDecision[] = []
  const partitioned = sheets.map(sheet => {
    if (sheet.type === 'UNKNOWN') return sheet // feuille non importée : aucune décision (pas de rejet ni de champ écarté)
    const rows: HistoricImportRow[] = []
    const rowNumbers: number[] = []
    const carriedColumns = Object.entries(sheet.transforms ?? {}).flatMap(([field, transform]) => transform?.carryForward ? splitHistoricMappedColumns(sheet.mapping[field]) : [])
    const lastValues = new Map<string, string>()
    const seenRefs = new Map<string, string>()
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
      // Ligne modèle : seule la référence est renseignée (VM_07…) — ignorée sans erreur, mais comptée au bilan.
      const refColumn = splitHistoricMappedColumns(sheet.mapping.externalId)[0]
      if (refColumn && isTemplateRow(row, refColumn)) { decisions.push({ sheetName: sheet.name ?? '', row: sourceRow, status: 'IGNORED', reason: 'EMPTY_TEMPLATE_ROW' }); return }
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
      // Référence déjà utilisée par une ligne précédente de la même feuille (et de la même analyse) : la ligne est rejetée, jamais fusionnée
      // en silence. Exception : une mesure répétée avec le même intitulé (contrôle partagé entre plusieurs risques) est fusionnée à la construction.
      const dupRefColumn = splitHistoricMappedColumns(sheet.mapping.externalId)[0]
      const dupRef = DUPLICATE_CHECKED.includes(sheet.type) && dupRefColumn ? text(row, dupRefColumn) : undefined
      if (dupRef) {
        const key = `${text(row, sheet.mapping.analysisExternalId) ?? ''}|${canonicalRef(dupRef)}`
        const title = normalise(text(row, sheet.mapping.title) ?? '')
        const previous = seenRefs.get(key)
        if (previous !== undefined && !(sheet.type === 'MEASURES' && previous === title)) { decisions.push({ sheetName: sheet.name ?? '', row: sourceRow, status: 'REJECTED', field: 'externalId', reason: 'DUPLICATE_REFERENCE', sourceColumn: dupRefColumn, sourceValue: dupRef }); return }
        if (previous === undefined) seenRefs.set(key, title)
      }
      for (const [field, column] of Object.entries(sheet.mapping)) {
        const value = text(row, column)
        if (!value || !invalidFormat(field, value, sheet.statusMapping, field === 'gravity' || field === 'likelihood' ? sheet.scoreMappings?.[field] : undefined)) continue
        for (const sourceColumn of splitHistoricMappedColumns(column)) row[sourceColumn] = ''
        decisions.push({ sheetName: sheet.name ?? '', row: sourceRow, status: 'FIELD_OMITTED', field, reason: 'INVALID_FORMAT', sourceColumn: column, sourceValue: value })
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
  // Références de risques citées par une mesure : « R_01 à R_09 », « R_05 R_07 » — résolues sur les identifiants réels des risques,
  // avec un éventuel alias de préfixe VALIDÉ par l'utilisateur (R_ ⇒ RI_). Un identifiant exact reste prioritaire (comportement historique).
  const riskIds = sheets.filter(sheet => sheet.type === 'RISKS').flatMap(sheet => sheet.rows.map(row => text(row, sheet.mapping.externalId)).filter((id): id is string => !!id))
  const riskByCanon = new Map(riskIds.map(id => [canonicalRef(id), id]))
  const patternOk = riskIds.length > 0 && riskIds.every(id => /^[A-Za-z][A-Za-z/]*[ _.-]?\d+[A-Za-z]?$/.test(id))
  const riskRefs = (row: HistoricImportRow, sheet: HistoricImportSheet): string[] => {
    const cell = text(row, sheet.mapping.riskExternalId)
    if (!cell) return []
    if (riskIds.includes(cell.trim())) return [cell.trim()]
    if (patternOk) {
      const aliases = sheet.refAliases ?? {}
      const prefixes = [...new Set([...prefixesOfRefs(riskIds), ...Object.keys(aliases).map(k => k.toUpperCase())])]
      const resolved = extractReferences(cell, { prefixes }).flatMap(r => { const id = riskByCanon.get(canonicalRef(aliasPrefix(r.raw, aliases))); return id ? [id] : [] })
      const unique = [...new Set(resolved)]
      if (unique.length) return unique
    }
    return [first(row, sheet, 'riskExternalId') ?? cell]
  }
  for (const sheet of sheets) for (const row of sheet.rows) {
    const title = first(row, sheet, 'title')
    if (sheet.type === 'ANALYSES' && title && result.analysis.title === fallbackTitle) {
      result.analysis = { title: title.slice(0, 200), description: descriptionText(row, sheet.mapping.description)?.slice(0, 2000) }
    }
    if (sheet.type === 'RISKS' && title) {
      const externalId = text(row, sheet.mapping.externalId)
      result.risks.push({ externalId, title: title.slice(0, 255), description: descriptionText(row, sheet.mapping.description)?.slice(0, 2000), gravity: score(row, sheet.mapping.gravity, sheet.scoreMappings?.gravity), likelihood: score(row, sheet.mapping.likelihood, sheet.scoreMappings?.likelihood), strategy: (v => (v ? normalizeStrategy(v) ?? v : undefined))(text(row, sheet.mapping.strategy)) })
      if (externalId) {
        for (const vulnerabilityTitle of values(row, sheet, 'embeddedVulnerabilities')) result.vulnerabilities.push({ riskExternalId: externalId, title: vulnerabilityTitle.slice(0, 500) })
        for (const actionTitle of values(row, sheet, 'embeddedActions')) result.actions.push({ riskExternalId: externalId, title: actionTitle.slice(0, 255) })
      }
    }
    if (sheet.type === 'VULNERABILITIES') {
      const riskExternalId = first(row, sheet, 'riskExternalId')
      if (riskExternalId) for (const vulnerabilityTitle of values(row, sheet, 'title')) result.vulnerabilities.push({ riskExternalId, title: vulnerabilityTitle.slice(0, 500), description: descriptionText(row, sheet.mapping.description)?.slice(0, 2000) })
    }
    if (sheet.type === 'MEASURES') { const refs = riskRefs(row, sheet); const rawStatus = first(row, sheet, 'status'); const titles = values(row, sheet, 'title'); for (const measureTitle of titles) result.measures.push({ externalId: titles.length === 1 ? first(row, sheet, 'externalId') : undefined, riskExternalId: refs[0], title: measureTitle.slice(0, 255), description: [descriptionText(row, sheet.mapping.description), refs.length > 1 ? `Risques concernés : ${refs.join(', ')}` : ''].filter(Boolean).join('\n\n').slice(0, 2000) || undefined, status: rawStatus ? sheet.statusMapping?.[rawStatus] ?? normalizeMeasureStatus(rawStatus) ?? rawStatus : undefined, responsible: first(row, sheet, 'responsible'), dueDate: dateText(row, sheet.mapping.dueDate) }) }
    if (sheet.type === 'ACTIONS') { const titles = values(row, sheet, 'title'); for (const actionTitle of titles) result.actions.push({ externalId: titles.length === 1 ? first(row, sheet, 'externalId') : undefined, riskExternalId: first(row, sheet, 'riskExternalId'), title: actionTitle.slice(0, 255), description: descriptionText(row, sheet.mapping.description)?.slice(0, 2000), responsible: first(row, sheet, 'responsible'), dueDate: dateText(row, sheet.mapping.dueDate) }) }
    if (sheet.type === 'RISK_ACTION_LINKS') {
      const riskReferences = values(row, sheet, 'riskExternalId')
      const actionReferences = values(row, sheet, 'actionExternalId')
      if (riskReferences.length === 1) for (const actionExternalId of actionReferences) result.links.push({ riskExternalId: riskReferences[0], actionExternalId })
      else if (actionReferences.length === 1) for (const riskExternalId of riskReferences) result.links.push({ riskExternalId, actionExternalId: actionReferences[0] })
      else if (riskReferences.length === actionReferences.length) riskReferences.forEach((riskExternalId, index) => result.links.push({ riskExternalId, actionExternalId: actionReferences[index] }))
    }
  }
  // Contexte : périmètre (blocs de texte) et page de garde (titre du projet, propriétés du document).
  for (const sheet of sheets) if (sheet.type === 'CONTEXT' && sheet.blocks) {
    const c = buildContextFromBlocks(sheet.blocks)
    if (Object.keys(c.context).length) result.context = { ...(result.context ?? {}), ...c.context }
    if (c.title && result.analysis.title === fallbackTitle) result.analysis.title = c.title.slice(0, 200)
    if (c.description && !result.analysis.description) result.analysis.description = c.description
  }
  // Ateliers 1 à 4 : feuilles dont le rôle est un rôle d'atelier → paquet canonique v3 (méthode EBIOS RM).
  const atelierSheets = sheets.filter(sheet => isAtelierRole(sheet.type)).map((sheet): AtelierSheet => ({ name: sheet.name ?? sheet.type, type: sheet.type as AtelierRole, mapping: sheet.mapping, rows: sheet.rows, valueMaps: sheet.valueMaps }))
  // Contrôle partagé : même référence ET même intitulé sur plusieurs lignes → UNE mesure (risque principal = le premier ; les autres sont listés).
  const sharedRisks = new Map<string, string[]>()
  const mergedMeasures: typeof result.measures = []
  for (const measure of result.measures) {
    const key = measure.externalId ? `${canonicalRef(measure.externalId)}|${normalise(measure.title)}` : ''
    const first = key ? mergedMeasures.find(m => m.externalId && `${canonicalRef(m.externalId)}|${normalise(m.title)}` === key) : undefined
    if (!first) { mergedMeasures.push(measure); if (key && measure.riskExternalId) sharedRisks.set(key, [measure.riskExternalId]); continue }
    if (measure.riskExternalId) sharedRisks.set(key, [...new Set([...(sharedRisks.get(key) ?? []), measure.riskExternalId])])
  }
  for (const measure of mergedMeasures) {
    const list = measure.externalId ? sharedRisks.get(`${canonicalRef(measure.externalId)}|${normalise(measure.title)}`) : undefined
    if (list && list.length > 1 && !(measure.description ?? '').includes('Risques concernés')) measure.description = [measure.description, `Risques concernés : ${list.join(', ')}`].filter(Boolean).join('\n\n').slice(0, 2000)
  }
  result.measures = mergedMeasures
  if (atelierSheets.length) {
    const { content, truncated } = buildAtelierContent(atelierSheets)
    if (truncated.length) result.truncated = truncated
    for (const [key, value] of Object.entries(content)) if (Array.isArray(value) ? value.length > 0 : !!value) (result as Record<string, unknown>)[key] = value
    result.analysis.methode = 'EBIOS_RM'
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
