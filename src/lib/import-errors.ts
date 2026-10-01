/**
 * import-errors.ts — Codes d'erreur STABLES des imports (JSON / CSV ACRA, Excel) — PUR.
 * Les routes renvoient un code (+ détails structurés) ; l'interface le traduit en titre / cause probable /
 * solution (`analyses.importMenu.importErrors.<code>`, 5 langues). Un test vérifie que chaque code est traduit.
 */

export const IMPORT_ERROR_CODES = [
  // Format de fichier (avant lecture)
  'excel_xls_unsupported', 'excel_format_unsupported', 'excel_file_type_invalid', 'excel_file_invalid',
  'import_use_excel', 'import_format_unsupported', 'import_file_empty', 'import_file_too_large', 'import_request_invalid',
  // JSON / CSV ACRA
  'json_empty', 'json_html', 'json_binary', 'json_invalid', 'json_not_object', 'json_missing_name', 'csv_not_acra',
  // Classeur Excel
  'excel_workbook_unreadable', 'excel_file_too_large', 'excel_rate_limited', 'excel_mapping_incomplete',
  'excel_no_importable_sheet', 'excel_too_many_rows', 'excel_duplicate_reference', 'excel_import_invalid',
  // Générique
  'import_rate_limited', 'import_failed',
  // Droits (audit 2026-10-01, T11)
  'import_forbidden', 'import_demo_cap',
] as const
export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[number]

/** Détails structurés d'une erreur (localisation d'une erreur de syntaxe, cause reconnue…). */
export type ImportErrorDetails = { line?: number; column?: number; snippet?: string; hint?: string; sheet?: string }

export class ImportError extends Error {
  constructor(public code: ImportErrorCode, public details?: ImportErrorDetails) { super(code) }
}

/** Statut HTTP conseillé pour un code d'erreur d'import. */
export function importErrorStatus(code: ImportErrorCode): number {
  switch (code) {
    case 'import_file_too_large': case 'excel_file_too_large': case 'excel_too_many_rows': return 413
    case 'import_rate_limited': case 'excel_rate_limited': return 429
    case 'excel_workbook_unreadable': case 'json_invalid': case 'json_empty': case 'json_html': case 'json_binary':
    case 'json_not_object': case 'json_missing_name': case 'csv_not_acra': case 'excel_import_invalid': case 'import_failed': return 422
    case 'import_forbidden': case 'import_demo_cap': return 403
    default: return 400
  }
}
