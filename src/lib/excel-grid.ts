// ─── Lecture de la grille d'une feuille Excel (ExcelJS) — lot I1 de l'import universel ───────────
// Trois lectures partagées par la prévisualisation et l'import :
//  - `readSheetSample`  : lignes d'en-tête candidates, cellules fusionnées lues UNE fois (cellule maîtresse) ;
//  - `sheetUsedBounds`  : zone réellement renseignée (pas la plage formatée : 16 384 colonnes vides possibles) ;
//  - `sheetFormulaIssues` : formules sans valeur enregistrée ou en erreur (jamais lues comme « vide » sans le dire).

import type { CellValue, Worksheet } from 'exceljs'
import { excelCellText } from '@/lib/excel-cell'

const isMergedSlave = (cell: { isMerged: boolean; master: unknown }) => cell.isMerged && cell.master !== cell
const isFormula = (v: unknown): v is { formula?: unknown; sharedFormula?: unknown; result?: unknown } => !!v && typeof v === 'object' && ('formula' in (v as object) || 'sharedFormula' in (v as object))
const ERROR_RE = /^#(REF|N\/A|DIV\/0|VALUE|NAME|NUM|NULL)[!?]?/

/** Texte des `maxRows` premières lignes et `maxColumns` premières colonnes ; un esclave de fusion vaut ''. */
export function readSheetSample(sheet: Worksheet, maxRows = 20, maxColumns = 100): string[][] {
  const rows = Math.min(maxRows, sheet.rowCount)
  return Array.from({ length: rows }, (_, r) => {
    const row = sheet.getRow(r + 1)
    return Array.from({ length: maxColumns }, (_, c) => {
      const cell = row.getCell(c + 1)
      return isMergedSlave(cell) ? '' : excelCellText(cell.value as CellValue)
    })
  })
}

/** Dernière ligne / colonne contenant une valeur (0 si la feuille est vide). */
export function sheetUsedBounds(sheet: Worksheet): { lastRow: number; lastColumn: number } {
  let lastRow = 0
  let lastColumn = 0
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (isMergedSlave(cell)) return
      if (excelCellText(cell.value as CellValue) === '' && !isFormula(cell.value)) return
      if (rowNumber > lastRow) lastRow = rowNumber
      if (colNumber > lastColumn) lastColumn = colNumber
    })
  })
  return { lastRow, lastColumn }
}

export interface FormulaIssue { count: number; samples: string[] }
const SAMPLES = 5
const MAX_CELLS = 200_000

/** Formules dont le résultat est absent (classeur jamais recalculé) ou en erreur (#REF!, #N/A…). */
export function sheetFormulaIssues(sheet: Worksheet): { withoutValue: FormulaIssue; errors: FormulaIssue } {
  const withoutValue: FormulaIssue = { count: 0, samples: [] }
  const errors: FormulaIssue = { count: 0, samples: [] }
  let seen = 0
  sheet.eachRow({ includeEmpty: false }, row => {
    row.eachCell({ includeEmpty: false }, cell => {
      if (++seen > MAX_CELLS) return
      const v = cell.value
      if (!isFormula(v)) return
      const r = v.result
      const bucket = r && typeof r === 'object' && 'error' in (r as object) ? errors
        : typeof r === 'string' && ERROR_RE.test(r) ? errors
          : r === undefined || r === null ? withoutValue : null
      if (!bucket) return
      bucket.count++
      if (bucket.samples.length < SAMPLES) bucket.samples.push(cell.address)
    })
  })
  return { withoutValue, errors }
}

export interface DataRowsOptions { refColumnIndex?: number; max?: number }

/**
 * Lignes de données sous l'en-tête. Une cellule fusionnée renvoie la valeur de sa cellule maîtresse (comportement historique :
 * une source fusionnée sur deux scénarios reste lue sur chacun). Exception (B-IMP-07) : si la colonne de RÉFÉRENCE d'une ligne
 * est une cellule fusionnée esclave, la ligne PROLONGE la précédente (deuxième source d'un même scénario…) : ses valeurs propres
 * (cellules non fusionnées) sont ajoutées, à la ligne, à celles de la ligne précédente, et aucune référence n'est dupliquée.
 */
export function readDataRows(sheet: Worksheet, layout: { headerRowIndex: number; columns: { key: string; index: number }[] }, opts: DataRowsOptions = {}): { rows: Record<string, string>[]; rowNumbers: number[] } {
  const rows: Record<string, string>[] = []
  const rowNumbers: number[] = []
  const last = sheetUsedBounds(sheet).lastRow
  const total = Math.min(opts.max ?? 500, Math.max(0, last - layout.headerRowIndex - 1))
  for (let offset = 0; offset < total; offset++) {
    const rowNumber = layout.headerRowIndex + offset + 2
    const row = sheet.getRow(rowNumber)
    const refCell = opts.refColumnIndex !== undefined ? row.getCell(opts.refColumnIndex + 1) : null
    const continuation = !!refCell && isMergedSlave(refCell) && rows.length > 0
    const values = Object.fromEntries(layout.columns.map(c => [c.key, excelCellText(row.getCell(c.index + 1).value as CellValue)]))
    if (!continuation) { rows.push(values); rowNumbers.push(rowNumber); continue }
    const previous = rows[rows.length - 1]
    for (const c of layout.columns) {
      const cell = row.getCell(c.index + 1)
      if (isMergedSlave(cell)) continue // valeur de la ligne maîtresse : déjà présente
      const own = values[c.key]
      if (own && own !== previous[c.key]) previous[c.key] = previous[c.key] ? `${previous[c.key]}\n${own}` : own
    }
  }
  return { rows, rowNumbers }
}
