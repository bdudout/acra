import { describe, expect, it } from 'vitest'
import { detectImportFileKind, checkExcelUpload, checkAcraUpload } from '@/lib/import-file-format'

const OLE2 = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0])
const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0])
const txt = (s: string) => new TextEncoder().encode(s)

describe('detectImportFileKind', () => {
  it('reconnaît un classeur binaire Excel 97-2003 par sa signature, quelle que soit l’extension', () => {
    expect(detectImportFileKind('audit.xls', OLE2)).toBe('XLS')
    expect(detectImportFileKind('audit.xlsx', OLE2)).toBe('XLS')
    expect(detectImportFileKind('audit.XLS', txt('quelconque'))).toBe('XLS')
  })
  it('xlsx = archive ZIP nommée .xlsx ; ZIP nommé autrement, ou .xlsm / .xlsb / .ods : non pris en charge', () => {
    expect(detectImportFileKind('audit.xlsx', ZIP)).toBe('XLSX')
    expect(detectImportFileKind('audit.xlsm', ZIP)).toBe('OTHER_SPREADSHEET')
    expect(detectImportFileKind('audit.xlsb', ZIP)).toBe('OTHER_SPREADSHEET')
    expect(detectImportFileKind('audit.ods', ZIP)).toBe('OTHER_SPREADSHEET')
    expect(detectImportFileKind('audit.numbers', ZIP)).toBe('OTHER_SPREADSHEET')
    expect(detectImportFileKind('audit.zip', ZIP)).toBe('ARCHIVE')
  })
  it('json, csv, vide, inconnu', () => {
    expect(detectImportFileKind('a.json', txt('{"nom":"x"}'))).toBe('JSON')
    expect(detectImportFileKind('a.csv', txt('a;b'))).toBe('CSV')
    expect(detectImportFileKind('a.csv', new Uint8Array())).toBe('EMPTY')
    expect(detectImportFileKind('a.docx', ZIP)).toBe('UNKNOWN')
    expect(detectImportFileKind('sans-extension', txt('x'))).toBe('UNKNOWN')
  })
})

describe('checkExcelUpload — import Excel', () => {
  it('xlsx accepté', () => expect(checkExcelUpload('a.xlsx', ZIP)).toBeNull())
  it('.xls (ou .xls renommé) : message dédié « .xls non pris en charge, .xlsx pris en charge »', () => {
    expect(checkExcelUpload('a.xls', OLE2)).toBe('excel_xls_unsupported')
    expect(checkExcelUpload('a.xlsx', OLE2)).toBe('excel_xls_unsupported')
  })
  it('autres tableurs, archives, csv/json, vide', () => {
    expect(checkExcelUpload('a.xlsm', ZIP)).toBe('excel_format_unsupported')
    expect(checkExcelUpload('a.ods', ZIP)).toBe('excel_format_unsupported')
    expect(checkExcelUpload('a.zip', ZIP)).toBe('excel_format_unsupported')
    expect(checkExcelUpload('a.csv', txt('a;b'))).toBe('excel_format_unsupported')
    expect(checkExcelUpload('a.xlsx', new Uint8Array())).toBe('import_file_empty')
    expect(checkExcelUpload('a.xlsx', txt('pas un zip'))).toBe('excel_workbook_unreadable')
  })
})

describe('checkAcraUpload — import JSON / CSV ACRA', () => {
  it('json et csv acceptés', () => {
    expect(checkAcraUpload('a.json', txt('{}'))).toBeNull()
    expect(checkAcraUpload('a.csv', txt('a'))).toBeNull()
  })
  it('un classeur Excel est orienté vers l’import Excel ; .xls avec le message dédié', () => {
    expect(checkAcraUpload('a.xlsx', ZIP)).toBe('import_use_excel')
    expect(checkAcraUpload('a.xls', OLE2)).toBe('excel_xls_unsupported')
  })
  it('autres formats et fichier vide', () => {
    expect(checkAcraUpload('a.pdf', txt('%PDF-1.4'))).toBe('import_format_unsupported')
    expect(checkAcraUpload('a.json', new Uint8Array())).toBe('import_file_empty')
  })
})

import { checkTabularUpload, looksLikeAcraCsv } from '@/lib/import-file-format'

describe('checkTabularUpload — assistant d’import (xlsx ou csv)', () => {
  it('xlsx et csv acceptés ; .xls et autres formats refusés avec le bon message', () => {
    expect(checkTabularUpload('a.xlsx', ZIP)).toBeNull()
    expect(checkTabularUpload('registre.csv', txt('Réf;Risque\nR1;x'))).toBeNull()
    expect(checkTabularUpload('a.xls', OLE2)).toBe('excel_xls_unsupported')
    expect(checkTabularUpload('a.ods', ZIP)).toBe('excel_format_unsupported')
    expect(checkTabularUpload('a.csv', new Uint8Array())).toBe('import_file_empty')
  })
  it('looksLikeAcraCsv : sections « === TITRE === » d’un export ACRA', () => {
    expect(looksLikeAcraCsv('Nom,X\n=== RISQUES ET TRAITEMENT ===\nA,1')).toBe(true)
    expect(looksLikeAcraCsv('Réf;Risque\nR1;x')).toBe(false)
  })
})
