// ─── CSV → classeur en mémoire (lot I7) ──────────────────────────────────────
// Un CSV vaut une feuille : il passe par le MÊME assistant que les classeurs (détection d'en-têtes, rôles, profils).
// Encodage UTF-8 (BOM toléré) ou Windows-1252 (export Excel français) ; séparateur `;` `,` détecté ; texte inerte (jamais de formule).

import ExcelJS from 'exceljs'
import { parseCsv } from '@/lib/incident-import'

function decode(buffer: Buffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer) } catch { return new TextDecoder('windows-1252').decode(buffer) }
}

export function csvToWorkbook(buffer: Buffer, filename: string): ExcelJS.Workbook {
  const rows = parseCsv(decode(buffer).replace(/^﻿/, ''))
  const wb = new ExcelJS.Workbook()
  const name = filename.replace(/\.[A-Za-z0-9]+$/, '').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Feuille'
  const ws = wb.addWorksheet(name)
  rows.forEach((cells, r) => cells.forEach((value, c) => { if (value !== '') { const cell = ws.getCell(r + 1, c + 1); cell.value = value; cell.numFmt = '@' } }))
  return wb
}
