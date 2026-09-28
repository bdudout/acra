import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { excelCellText } from '@/lib/excel-cell'

/** Classeur réel écrit puis relu : mêmes structures de valeurs qu'un fichier client. */
async function roundTrip(values: ExcelJS.CellValue[]) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('S')
  const row = ws.getRow(1); values.forEach((v, i) => { row.getCell(i + 1).value = v }); row.commit()
  const back = new ExcelJS.Workbook(); await back.xlsx.load(await wb.xlsx.writeBuffer() as ExcelJS.Buffer)
  return values.map((_, i) => excelCellText(back.worksheets[0].getRow(1).getCell(i + 1).value))
}

describe('excelCellText', () => {
  it('lit le résultat d’une formule (ex. Niveau = G×V) et le texte enrichi', async () => {
    expect(await roundTrip([
      { formula: 'B1*C1', result: 12 },
      { richText: [{ text: 'Texte ' }, { font: { bold: true }, text: 'enrichi' }] },
    ])).toEqual(['12', 'Texte enrichi'])
  })

  it('dates en ISO, liens hypertexte par leur texte, erreurs vides, nombres et chaînes', async () => {
    expect(await roundTrip([
      new Date(Date.UTC(2026, 8, 28)),
      { text: 'Fiche', hyperlink: 'https://example.org' },
      { error: '#N/A' },
      3, '  Risque  ', null,
    ])).toEqual(['2026-09-28', 'Fiche', '', '3', 'Risque', ''])
  })

  it('formule dont le résultat est une date', () => {
    expect(excelCellText({ formula: 'TODAY()', result: new Date(Date.UTC(2026, 0, 2)) } as ExcelJS.CellValue)).toBe('2026-01-02')
  })
})
