import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildReseauXlsx } from '@/lib/controle-reseau-xlsx'
import { fr } from '@/lib/i18n/fr'

describe('export Excel des contrôles en réseau', () => {
  it('une ligne par contrôle de référence, une colonne par entité, synthèse ; cellules neutralisées', async () => {
    const buf = await buildReseauXlsx({
      entites: [{ id: 'f1', nom: 'Filiale 1' }, { id: 'f2', nom: '=Filiale 2' }],
      references: [{
        intitule: 'Revue des accès',
        cellules: [{ organizationId: 'f1', controleId: 'c1', dernierResultat: 'CONFORME', derniereExecution: new Date('2026-09-15'), etat: 'A_VENIR', taux: 100 }],
        synthese: { entites: 1, conformes: 1, anomalies: 0, enRetard: 0, sansExecution: 0, taux: 100 },
      }],
    }, { labels: fr.controleReseau, organisation: 'Mère', now: new Date('2026-10-03') })
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as never)
    const ws = wb.worksheets[0]
    expect(ws.getRow(1).values).toEqual(expect.arrayContaining(['Contrôle', 'Filiale 1', "'=Filiale 2", 'Conformité']))
    const r2 = (ws.getRow(2).values as unknown[]).map(String)
    expect(r2).toEqual(expect.arrayContaining(['Revue des accès', 'Non décliné', '100 %']))
    expect(r2.some(v => /Conforme — À jour — 2026-09-15/.test(v))).toBe(true)
  })
})
