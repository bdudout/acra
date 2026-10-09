// ─── Import d'un classeur (xlsx / csv) : lecture partagée par l'interface et l'API v2 ──────────────────────────────────
// Aperçu (rôles détectés, colonnes, mapping proposé) et préparation des paquets d'import à partir d'un classeur chargé et
// d'une sélection (rôles, colonnes, correspondances de valeurs). Code déplacé tel quel des routes web
// `analysis-imports/preview` et `analysis-imports` pour que l'API v2 (B-IMP-72) lise un fichier exactement comme
// l'interface. Les erreurs codées (`MAPPING_INCOMPLET:…`, `TOO_MANY_ROWS:…`, `NO_IMPORTABLE_SHEET`) sont traduites par
// l'appelant.
import type ExcelJS from 'exceljs'
import { excelCellText } from '@/lib/excel-cell'
import { detectContextSheet, extractKeyValueBlocks, extractTextBlocks } from '@/lib/excel-blocks'
import { suggestAtelierMapping } from '@/lib/import-ateliers-build'
import { readDataRows, readSheetSample, sheetFormulaIssues, sheetUsedBounds } from '@/lib/excel-grid'
import {
  applyHistoricRowOverrides, buildHistoricImportPackages, detectHistoricHeaderLayout, detectHistoricImportSheet, isAtelierRole, linkChildSheetsToRisks,
  partitionHistoricImportSheets, profileHistoricColumn, refineReferenceMapping, resolveHistoricImportSheetType, splitHistoricMappedColumns,
  suggestHistoricColumnMapping, validateHistoricColumnMapping, validateHistoricImportFormats, validateHistoricImportSelection,
  type HistoricColumnMapping, type HistoricFieldTransforms, type HistoricImportPartition, type HistoricRowOverrides, type HistoricSheetType,
} from '@/lib/historic-import'

/** Aperçu d'un classeur : par feuille, rôle détecté, colonnes, profil des valeurs, mapping proposé et anomalies de formules. */
export function apercuClasseur(workbook: ExcelJS.Workbook) {
  const sheets = workbook.worksheets.slice(0, 20).map(sheet => {
    // Échantillon d'en-tête : fusions lues une fois (titre / bandeau ≠ en-tête) ; zone utile et formules sans valeur signalées (lot I1).
    const layout = detectHistoricHeaderLayout(readSheetSample(sheet, 20, 100))
    const columns = layout.columns
    const header = columns.map(column => column.key)
    let detection = detectHistoricImportSheet(sheet.name, header)
    // Feuille sans tableau : périmètre en texte libre ou page de garde (rôle « contexte »).
    const contextKind = detection.type === 'UNKNOWN' ? detectContextSheet(sheet.name, readSheetSample(sheet, 80, 20)) : null
    if (contextKind) detection = { type: 'CONTEXT', confidence: 'MEDIUM', missing: [] }
    const { lastRow } = sheetUsedBounds(sheet)
    const dataRowCount = contextKind ? Math.max(1, lastRow) : Math.max(0, lastRow - layout.headerRowIndex - 1)
    const dataRows = Array.from({ length: Math.min(500, dataRowCount) }, (_, offset) => sheet.getRow(layout.headerRowIndex + offset + 2))
    const profiles = Object.fromEntries(columns.map(column => [column.key, profileHistoricColumn(dataRows.map(row => {
      const value = row.getCell(column.index + 1).value
      return excelCellText(value)
    }))]))
    // Une « référence » aux valeurs répétées est un regroupement : on lui préfère la colonne à valeurs uniques.
    const suggested = isAtelierRole(detection.type) ? suggestAtelierMapping(detection.type, header) : suggestHistoricColumnMapping(header)
    const mapping = isAtelierRole(detection.type) ? suggested : refineReferenceMapping(suggested, header, profiles)
    const issues = sheetFormulaIssues(sheet)
    return { name: sheet.name, columns: header, profiles, rows: dataRowCount, headerRow: layout.headerRowIndex + 1, detection, mapping, missing: validateHistoricColumnMapping(detection.type, mapping), warnings: { formulasWithoutValue: issues.withoutValue, formulaErrors: issues.errors } }
  })
  return linkChildSheetsToRisks(sheets)
}

/** Sélection appliquée au classeur : mêmes champs que l'assistant de l'interface (et qu'un mapping enregistré). */
export interface SelectionClasseur {
  mappings: Record<string, Record<string, string | undefined>>
  sheetTypes: Record<string, HistoricSheetType>
  transforms: Record<string, Record<string, { mode?: 'LINES' | 'SEMICOLON' | 'PIPE'; carryForward?: boolean } | undefined>>
  statusMappings: Record<string, Record<string, string>>
  scoreMappings: Record<string, Record<string, Record<string, string>>>
  partialImport: boolean
  valueMaps: Record<string, { category?: Record<string, string>; type?: Record<string, string> }>
  refAliases: Record<string, Record<string, string>>
  rowOverrides: HistoricRowOverrides
}

/**
 * Lit les feuilles selon la sélection et répartit les lignes (prêtes / champ écarté / rejetées / ignorées). Lève
 * `MAPPING_INCOMPLET:<feuille>`, `TOO_MANY_ROWS:<feuille>` ou `MAPPING_INCOMPLET:cross_sheet_reference_or_format`.
 */
export function repartirClasseur(workbook: ExcelJS.Workbook, sel: SelectionClasseur): HistoricImportPartition {
  const sheets = workbook.worksheets.slice(0, 20).map(sheet => {
    const layout = detectHistoricHeaderLayout(readSheetSample(sheet, 20, 100)) // même lecture que l'aperçu
    const headers = layout.columns.map(column => column.key)
    const detection = detectHistoricImportSheet(sheet.name, headers)
    const type = resolveHistoricImportSheetType(detection.type, sel.sheetTypes[sheet.name])
    const mapping = (sel.mappings[sheet.name] ?? {}) as HistoricColumnMapping
    if (type !== 'UNKNOWN' && validateHistoricColumnMapping(type, mapping).length) throw new Error(`MAPPING_INCOMPLET:${sheet.name}`)
    // Colonne de référence du rôle : une ligne dont la référence est une cellule fusionnée esclave prolonge la précédente.
    const refColumn = splitHistoricMappedColumns(mapping.externalId)[0]
    const refIndex = layout.columns.find(column => column.key === refColumn)?.index
    const { rows: dataRows, rowNumbers: dataRowNumbers, truncated } = type === 'CONTEXT' ? { rows: [], rowNumbers: [], truncated: false } : readDataRows(sheet, layout, { refColumnIndex: refIndex })
    // Plafond de lignes : jamais de troncature silencieuse (une feuille ignorée n'est pas concernée).
    if (truncated && type !== 'UNKNOWN') throw new Error(`TOO_MANY_ROWS:${sheet.name}`)
    const rows = dataRows; const rowNumbers = dataRowNumbers
    const contextRows = type === 'CONTEXT' ? readSheetSample(sheet, 80, 20) : null
    const blocks = contextRows ? { text: extractTextBlocks(contextRows), kv: extractKeyValueBlocks(contextRows) } : undefined
    const profiles = Object.fromEntries(headers.map(header => [header, profileHistoricColumn(rows.map(row => row[header] ?? ''))]))
    return { name: sheet.name, type, mapping, transforms: sel.transforms[sheet.name] as HistoricFieldTransforms | undefined, statusMapping: sel.statusMappings[sheet.name], scoreMappings: sel.scoreMappings[sheet.name], rows, rowNumbers, profiles, blocks, refAliases: sel.refAliases[sheet.name], valueMaps: sel.valueMaps[sheet.name] }
  })
  const correctedSheets = applyHistoricRowOverrides(sheets, sel.rowOverrides)
  if (validateHistoricImportSelection(sheets).length || (!sel.partialImport && validateHistoricImportFormats(sheets).length)) throw new Error('MAPPING_INCOMPLET:cross_sheet_reference_or_format')
  return sel.partialImport ? partitionHistoricImportSheets(correctedSheets) : { sheets: correctedSheets, decisions: [] }
}

/** Paquets canoniques à importer (un par analyse du classeur) ; lève `NO_IMPORTABLE_SHEET` si rien n'est importable. */
export function paquetsClasseur(partition: HistoricImportPartition, filename: string) {
  if (!partition.sheets.some(sheet => sheet.type !== 'UNKNOWN' && (sheet.rows.length > 0 || (sheet.blocks && (sheet.blocks.text.length > 0 || sheet.blocks.kv.length > 0))))) throw new Error('NO_IMPORTABLE_SHEET')
  return buildHistoricImportPackages(partition.sheets, filename.replace(/\.(xlsx|csv)$/i, ''))
}
