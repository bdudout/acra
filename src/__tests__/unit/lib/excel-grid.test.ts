// @vitest-environment node
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { readSheetSample, sheetUsedBounds, sheetFormulaIssues, readDataRows } from '@/lib/excel-grid'
import { detectHistoricHeaderLayout } from '@/lib/historic-import'

/** Classeur en mémoire reproduisant les pièges d'un dossier EBIOS RM (titre fusionné, bandeau, formules, cellules formatées vides). */
function classeur() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('1 - SROV')
  ws.getCell('A1').value = 'Analyse de risques 1 - Sélection et évaluation des couples SR/OV'
  ws.mergeCells('A1:H1')
  ws.getCell('A4').value = 'Identification'; ws.mergeCells('A4:C4')
  ws.getCell('D4').value = 'Cotation'; ws.mergeCells('D4:G4')
  ;['Réf.SR/OV', 'Sources de risques', 'Objectifs visés', 'Motivation', 'Ressources', 'Pertinence', 'Retenu ?', 'Justification'].forEach((h, i) => { ws.getCell(5, i + 1).value = h })
  ws.getCell('A6').value = 'SR/OV_01'; ws.getCell('B6').value = 'Etat'; ws.getCell('C6').value = 'Espionnage'
  ws.getCell('F6').value = { formula: 'INDEX(A1:A2,1)', result: '3 - Elevé' }
  ws.getCell('F7').value = { formula: 'D7*E7' } // formule sans valeur enregistrée
  ws.getCell('F8').value = { formula: '#REF!', result: { error: '#REF!' } } as ExcelJS.CellValue
  ws.getCell('A30').style = { font: { bold: true } } // cellule formatée mais vide, loin dans la feuille
  ws.getCell('XFD40').style = { font: { bold: true } }
  return ws
}

describe('readSheetSample — échantillon d’en-tête', () => {
  it('cellules fusionnées : la valeur n’apparaît que sur la cellule maîtresse', () => {
    const rows = readSheetSample(classeur(), 6, 10)
    expect(rows[0].filter(Boolean)).toEqual(['Analyse de risques 1 - Sélection et évaluation des couples SR/OV'])
    expect(rows[3].filter(Boolean)).toEqual(['Identification', 'Cotation'])
  })
  it('l’en-tête est trouvé sur la bonne ligne malgré titre fusionné et bandeau', () => {
    expect(detectHistoricHeaderLayout(readSheetSample(classeur(), 20, 100)).headerRowIndex).toBe(4)
  })
  it('formule : résultat en cache ; sans résultat ou en erreur : vide', () => {
    const rows = readSheetSample(classeur(), 8, 10)
    expect(rows[5][5]).toBe('3 - Elevé')
    expect(rows[6][5]).toBe('')
    expect(rows[7][5]).toBe('')
  })
})

describe('sheetUsedBounds — zone utile', () => {
  it('ignore les cellules formatées vides (dernière ligne / colonne réellement renseignées)', () => {
    expect(sheetUsedBounds(classeur())).toEqual({ lastRow: 8, lastColumn: 8 })
  })
  it('feuille vide', () => expect(sheetUsedBounds(new ExcelJS.Workbook().addWorksheet('x'))).toEqual({ lastRow: 0, lastColumn: 0 }))
})

describe('sheetFormulaIssues — formules sans valeur et en erreur (B-IMP-08)', () => {
  it('signale, avec l’adresse, les formules sans valeur enregistrée et les erreurs de formule', () => {
    const i = sheetFormulaIssues(classeur())
    expect(i.withoutValue).toEqual({ count: 1, samples: ['F7'] })
    expect(i.errors).toEqual({ count: 1, samples: ['F8'] })
  })
  it('classeur sans formule problématique : rien à signaler ; échantillons bornés', () => {
    const ws = new ExcelJS.Workbook().addWorksheet('x')
    for (let r = 1; r <= 40; r++) ws.getCell(r, 1).value = { formula: 'B1+1' }
    const i = sheetFormulaIssues(ws)
    expect(i.withoutValue.count).toBe(40)
    expect(i.withoutValue.samples).toHaveLength(5)
    expect(sheetFormulaIssues(new ExcelJS.Workbook().addWorksheet('y'))).toEqual({ withoutValue: { count: 0, samples: [] }, errors: { count: 0, samples: [] } })
  })
})

describe('readDataRows — lignes de continuation (cellules fusionnées verticalement)', () => {
  function scenarios() {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('3 - S.Stratégiques')
    ;['Réf.SS', 'Scénario', 'Source', 'Gravité'].forEach((h, i) => { ws.getCell(1, i + 1).value = h })
    ws.getCell('A2').value = 'SS_01'; ws.getCell('B2').value = 'Scénario un'; ws.getCell('C2').value = 'Etat'; ws.getCell('D2').value = '2 - Limitée'
    ws.getCell('A3').value = 'SS_06'; ws.getCell('B3').value = 'Usurpation'; ws.getCell('C3').value = 'Crime organisé'; ws.getCell('D3').value = '3 - Importante'
    ws.mergeCells('A3:A4'); ws.mergeCells('B3:B4'); ws.mergeCells('D3:D4')
    ws.getCell('C4').value = 'Malveillant interne' // 2ᵉ source du même scénario, sur la ligne fusionnée
    ws.getCell('A5').value = 'SS_07'; ws.getCell('B5').value = 'Vol'; ws.getCell('C5').value = 'Externe'; ws.getCell('D5').value = '3 - Importante'
    return ws
  }
  const layout = { headerRowIndex: 0, columns: ['Réf.SS', 'Scénario', 'Source', 'Gravité'].map((k, index) => ({ key: k, label: k, index })) }

  it('la ligne dont la référence est une cellule fusionnée esclave prolonge la ligne précédente : pas de doublon de référence', () => {
    const { rows, rowNumbers } = readDataRows(scenarios(), layout, { refColumnIndex: 0 })
    expect(rows.map(r => r['Réf.SS'])).toEqual(['SS_01', 'SS_06', 'SS_07'])
    expect(rows[1].Source).toBe('Crime organisé\nMalveillant interne')
    expect(rows[1].Scénario).toBe('Usurpation')
    expect(rowNumbers).toEqual([2, 3, 5])
  })
  it('sans colonne de référence : lecture inchangée (valeur maîtresse répétée)', () => {
    const { rows } = readDataRows(scenarios(), layout, {})
    expect(rows).toHaveLength(4)
    expect(rows[2]['Réf.SS']).toBe('SS_06')
  })
})
