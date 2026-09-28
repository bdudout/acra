import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { checkXlsxArchive, XLSX_MAX_UNCOMPRESSED_BYTES } from '@/lib/xlsx-guard'

async function workbook(rows: number) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Risques')
  ws.addRow(['Risque', 'Gravité', 'Vraisemblance'])
  for (let i = 0; i < rows; i++) ws.addRow([`Risque ${i}`, 3, 2])
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe('checkXlsxArchive', () => {
  it('accepte un classeur normal', async () => {
    expect(checkXlsxArchive(await workbook(10))).toEqual({ ok: true, entries: expect.any(Number), uncompressed: expect.any(Number) })
  })

  it('refuse un classeur dont la taille DÉCOMPRESSÉE dépasse la limite (avant tout chargement)', async () => {
    const buf = await workbook(2000)
    const res = checkXlsxArchive(buf, { maxUncompressed: 50_000 })
    expect(res).toMatchObject({ ok: false, reason: 'TOO_LARGE_UNCOMPRESSED' })
    expect(XLSX_MAX_UNCOMPRESSED_BYTES).toBeGreaterThanOrEqual(10 * 1024 * 1024)
  })

  it('refuse trop d’entrées dans l’archive', async () => {
    expect(checkXlsxArchive(await workbook(1), { maxEntries: 2 })).toMatchObject({ ok: false, reason: 'TOO_MANY_ENTRIES' })
  })

  it('refuse un contenu qui n’est pas une archive zip', () => {
    expect(checkXlsxArchive(Buffer.from('ceci n’est pas un xlsx'))).toMatchObject({ ok: false, reason: 'NOT_ZIP' })
  })

  it('refuse le zip64 (tailles masquées) plutôt que de le décompresser', async () => {
    const buf = Buffer.from(await workbook(1))
    // Marque la 1ʳᵉ entrée de l'annuaire central avec la taille sentinelle zip64.
    const cd = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
    buf.writeUInt32LE(0xffffffff, cd + 24)
    expect(checkXlsxArchive(buf)).toMatchObject({ ok: false, reason: 'ZIP64_UNSUPPORTED' })
  })
})
