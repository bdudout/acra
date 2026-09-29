/**
 * import-file-format.ts — Reconnaissance du format d'un fichier d'import AVANT tout envoi (PUR).
 * Utilisé par l'interface (contrôle à la sélection) et par les routes (même verdict côté serveur).
 * Le contenu prime sur l'extension : un `.xls` renommé en `.xlsx` reste un classeur binaire non pris en charge.
 */

export type ImportFileKind = 'XLSX' | 'XLS' | 'OTHER_SPREADSHEET' | 'ARCHIVE' | 'JSON' | 'CSV' | 'EMPTY' | 'UNKNOWN'

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v)
const isOle2 = (b: Uint8Array) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const isZip = (b: Uint8Array) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])
const extension = (name: string) => (/\.([a-z0-9]+)$/i.exec(name.trim())?.[1] ?? '').toLowerCase()

/** `head` : au moins les 8 premiers octets du fichier. */
export function detectImportFileKind(filename: string, head: Uint8Array): ImportFileKind {
  if (head.length === 0) return 'EMPTY'
  if (isOle2(head)) return 'XLS' // classeur Excel 97-2003 (ou ancien format Office), même renommé
  const ext = extension(filename)
  if (ext === 'xls') return 'XLS'
  if (['xlsm', 'xlsb', 'ods', 'numbers', 'xltx', 'xltm'].includes(ext)) return 'OTHER_SPREADSHEET'
  if (ext === 'xlsx') return isZip(head) ? 'XLSX' : 'UNKNOWN'
  if (ext === 'zip') return 'ARCHIVE'
  if (ext === 'json') return 'JSON'
  if (ext === 'csv') return 'CSV'
  return 'UNKNOWN'
}

export type ImportFileErrorCode =
  | 'excel_xls_unsupported' | 'excel_format_unsupported' | 'excel_workbook_unreadable'
  | 'import_use_excel' | 'import_format_unsupported' | 'import_file_empty'

/** Import Excel : seul `.xlsx` (archive ZIP valide) est accepté. */
export function checkExcelUpload(filename: string, head: Uint8Array): ImportFileErrorCode | null {
  if (head.length === 0) return 'import_file_empty'
  if (isOle2(head)) return 'excel_xls_unsupported'
  const kind = detectImportFileKind(filename, head)
  switch (kind) {
    case 'XLSX': return null
    case 'XLS': return 'excel_xls_unsupported'
    // `.xlsx` sans signature ZIP : ni un classeur binaire ancien (traité plus haut) ni une archive valide.
    case 'UNKNOWN': return extension(filename) === 'xlsx' ? 'excel_workbook_unreadable' : 'excel_format_unsupported'
    default: return 'excel_format_unsupported'
  }
}

/** Import d'un export ACRA : JSON ou CSV uniquement ; un classeur est orienté vers l'import Excel. */
export function checkAcraUpload(filename: string, head: Uint8Array): ImportFileErrorCode | null {
  if (head.length === 0) return 'import_file_empty'
  if (isOle2(head)) return 'excel_xls_unsupported'
  const kind = detectImportFileKind(filename, head)
  if (kind === 'JSON' || kind === 'CSV') return null
  if (kind === 'XLSX') return 'import_use_excel'
  if (kind === 'XLS') return 'excel_xls_unsupported'
  return 'import_format_unsupported'
}

/** Assistant d'import tabulaire : classeur `.xlsx`, fichier `.csv` (une feuille) ou JSON de forme libre (une feuille par tableau). */
export function checkTabularUpload(filename: string, head: Uint8Array): ImportFileErrorCode | null {
  if (head.length === 0) return 'import_file_empty'
  if (isOle2(head)) return 'excel_xls_unsupported'
  const kind = detectImportFileKind(filename, head)
  if (kind === 'CSV' || kind === 'JSON') return null
  return checkExcelUpload(filename, head)
}

/** Un CSV d'export ACRA contient des sections « === TITRE === » ; un registre plat n'en a pas (il passe par l'assistant). */
export function looksLikeAcraCsv(text: string): boolean {
  return /^=== .+ ===\s*$/m.test(text)
}

/** Un export ACRA porte `analyse.nom` (ou `nom`) ; tout autre objet/tableau JSON passe par l'assistant. Un texte non JSON reste à la route ACRA (diagnostic précis). */
export function looksLikeAcraJson(text: string): boolean {
  let v: unknown
  try { v = JSON.parse(text.replace(/^﻿/, '')) } catch { return true }
  if (!(!!v && typeof v === 'object' && !Array.isArray(v))) return false
  const src = (v as Record<string, unknown>).analyse && typeof (v as Record<string, unknown>).analyse === 'object' ? (v as Record<string, Record<string, unknown>>).analyse : (v as Record<string, unknown>)
  return typeof src.nom === 'string' && src.nom !== ''
}

