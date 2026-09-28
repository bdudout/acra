// @vitest-environment node
// P4 — rapport Excel des méthodes directes : feuilles attendues, injection de formule neutralisée.
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { resolveScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT } from '@/lib/appetit'
import { buildDirectReport } from '@/lib/rapport-methode-directe'
import { buildDirectReportWorkbook } from '@/lib/rapport-methode-directe-xlsx'

const report = buildDirectReport({
  analyse: { nom: 'SI', methode: 'ISO_27005', cadrage: { perimetre: 'DPI', objectifsEtude: 'x' } },
  risques: [{ id: 'a', nom: '=HYPERLINK("http://evil","clic")', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', proprietaire: 'DSI', vulnerabilites: [{ description: 'RDP exposé' }] }],
  mesures: [{ nom: 'Sauvegardes', statut: 'REALISE', efficacite: 3, echeance: null, responsable: null, risqueId: 'a' }],
  plans: [{ titre: 'MFA', statut: 'A_FAIRE', priorite: 'MAJEUR', echeance: null, porteur: 'RSSI', risqueIds: ['a'] }],
}, { scale: resolveScaleConfig(null), appetit: APPETIT_DEFAULT })

describe('buildDirectReportWorkbook', () => {
  it('feuilles traduites et registre complet', async () => {
    const wb = await buildDirectReportWorkbook(report, 'fr')
    expect(wb.worksheets.map(w => w.name)).toEqual(['Synthèse', 'Registre des risques', 'Vulnérabilités', 'Mesures', 'Plans d’action'])
    const reg = wb.getWorksheet('Registre des risques')!
    expect(reg.getRow(1).values).toContain('Propriétaire')
    const r2 = reg.getRow(2).values as unknown[]
    expect(r2).toContain('R1'); expect(r2).toContain('DSI'); expect(r2).toContain('À traiter'); expect(r2).toContain(12)
  })

  it('neutralise l’injection de formule dans les textes saisis', async () => {
    const wb = await buildDirectReportWorkbook(report, 'en')
    const reg = wb.getWorksheet('Risk register')!
    const cells = (reg.getRow(2).values as unknown[]).filter(v => typeof v === 'string') as string[]
    expect(cells.some(c => c.startsWith("'=HYPERLINK"))).toBe(true)
    expect(cells.some(c => c.startsWith('=HYPERLINK'))).toBe(false)
    const buf = Buffer.from(await wb.xlsx.writeBuffer())
    const back = new ExcelJS.Workbook(); await back.xlsx.load(buf as unknown as ExcelJS.Buffer)
    expect(back.worksheets).toHaveLength(5)
  })
})
