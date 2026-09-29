// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { csvToWorkbook } from '@/lib/csv-workbook'

describe('csvToWorkbook — un CSV vaut une feuille', () => {
  it('séparateur ;, BOM et guillemets ; nom de la feuille = nom du fichier', () => {
    const wb = csvToWorkbook(Buffer.from('﻿Réf;Risque;Description\r\nR-01;"Rançongiciel; grave";"Ligne 1\nLigne 2"\r\nR-02;Fuite;\r\n', 'utf8'), 'registre.csv')
    const ws = wb.worksheets[0]
    expect(ws.name).toBe('registre')
    expect(ws.getRow(1).values).toEqual([undefined, 'Réf', 'Risque', 'Description'])
    expect(ws.getCell('B2').value).toBe('Rançongiciel; grave')
    expect(ws.getCell('C2').value).toBe('Ligne 1\nLigne 2')
    expect(ws.rowCount).toBe(3)
  })
  it('encodage Windows-1252 (export Excel français) décodé sans caractères de remplacement', () => {
    const latin1 = Buffer.from([0x52, 0xe9, 0x66, 0x3b, 0x52, 0x69, 0x73, 0x71, 0x75, 0x65, 0x0a, 0x52, 0x31, 0x3b, 0x46, 0x75, 0x69, 0x74, 0x65, 0x20, 0x64, 0x27, 0xe9, 0x74, 0xe9]) // Réf;Risque / R1;Fuite d'été
    const ws = csvToWorkbook(latin1, 'x.csv').worksheets[0]
    expect(ws.getCell('A1').value).toBe('Réf')
    expect(ws.getCell('B2').value).toBe('Fuite d\'été')
  })
  it('nom de feuille valide pour Excel (≤ 31 caractères, sans caractères interdits)', () => {
    const ws = csvToWorkbook(Buffer.from('a\n1'), 'un:nom/très*long[et]?interdit-pour-excel-vraiment.csv').worksheets[0]
    expect(ws.name.length).toBeLessThanOrEqual(31)
    expect(ws.name).not.toMatch(/[\\/?*[\]:]/)
  })
  it('les cellules ne sont jamais interprétées comme des formules (=, +, -, @ conservés en texte)', () => {
    const ws = csvToWorkbook(Buffer.from('a;b\n=1+1;+x'), 'f.csv').worksheets[0]
    expect(ws.getCell('A2').value).toBe('=1+1')
    expect(typeof ws.getCell('A2').value).toBe('string')
  })
})
