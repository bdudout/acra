// ─── Lecture d'une cellule Excel (ExcelJS) en texte (PUR) ────────────────────
// Source unique pour les imports Excel. ExcelJS renvoie des OBJETS pour les
// formules ({ formula, result }), le texte enrichi ({ richText: [...] }), les liens
// ({ text, hyperlink }) et les erreurs ({ error }) : un simple String(value) les
// transforme en « [object Object] » (constat d'audit 2026-09-28).

import type { CellValue } from 'exceljs'

/** Texte d'une valeur de cellule : dates en ISO (AAAA-MM-JJ), formules par leur résultat. */
export function excelCellText(value: CellValue | undefined): string {
  if (value == null) return ''
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? '' : value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>
    if ('error' in v) return ''
    if ('richText' in v && Array.isArray(v.richText)) return v.richText.map(part => String((part as { text?: unknown }).text ?? '')).join('').trim()
    if ('formula' in v || 'sharedFormula' in v) return 'result' in v ? excelCellText(v.result as CellValue) : ''
    if ('text' in v) return excelCellText(v.text as CellValue)
    return ''
  }
  return String(value).trim()
}
