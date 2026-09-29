// ─── Chargement d'un fichier tabulaire en classeur (xlsx, csv, json libre) ───
// Point unique pour l'aperçu et l'exécution de l'assistant d'import : mêmes bornes, mêmes verdicts.

import ExcelJS from 'exceljs'
import { checkXlsxArchive } from '@/lib/xlsx-guard'
import { csvToWorkbook } from '@/lib/csv-workbook'
import { jsonToWorkbook } from '@/lib/json-workbook'
import { diagnoseJsonText } from '@/lib/import-json-diagnostic'

export type TabularKind = 'XLSX' | 'CSV' | 'JSON'
export const tabularKind = (filename: string): TabularKind => /\.csv$/i.test(filename) ? 'CSV' : /\.json$/i.test(filename) ? 'JSON' : 'XLSX'

export type TabularLoad =
  | { ok: true; workbook: ExcelJS.Workbook }
  | { ok: false; status: number; error: string; details?: Record<string, unknown> }

/** Vérifications d'archive (xlsx) ou de syntaxe (json) puis construction du classeur ; ne lève pas pour un fichier invalide. */
export async function loadTabularWorkbook(buffer: Buffer, filename: string): Promise<TabularLoad> {
  const kind = tabularKind(filename)
  if (kind === 'CSV') return { ok: true, workbook: csvToWorkbook(buffer, filename) }
  if (kind === 'JSON') {
    const diag = diagnoseJsonText(buffer.toString('utf8'))
    if (!diag.ok) return { ok: false, status: 400, error: diag.code, details: { line: diag.line, column: diag.column, snippet: diag.snippet, hint: diag.hint } }
    return { ok: true, workbook: jsonToWorkbook(buffer, filename) }
  }
  const archive = checkXlsxArchive(buffer)
  if (!archive.ok) return { ok: false, status: archive.reason === 'NOT_ZIP' ? 422 : 413, error: archive.reason === 'NOT_ZIP' ? 'excel_workbook_unreadable' : 'excel_file_too_large' }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as never)
  return { ok: true, workbook }
}
