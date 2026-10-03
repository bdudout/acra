import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { portefeuille360 } from '@/lib/projet360-portefeuille'
import { buildPortefeuille360Xlsx } from '@/lib/projet360-portefeuille-xlsx'

const r = (domaine: string | null, niveauRisque: number, niveauResiduel: number | null = null) => ({ id: Math.random().toString(36), nom: 'x', domaine, niveauRisque, niveauResiduel })
const projets = [
  { id: 'p1', nom: 'Migration cloud', statut: 'EN_COURS', risques: [r('CYBER', 12, 6), r('CYBER', 4), r('OUTSOURCING', 9), r(null, 16)] },
  { id: 'p2', nom: 'Nouvelle appli', statut: 'TERMINE', risques: [r('CYBER', 8), r('FRAUD', 15)] },
  { id: 'p3', nom: 'Projet vide', statut: 'EN_COURS', risques: [] },
]

describe('portefeuille de projets 360 (domaine × projet)', () => {
  const p = portefeuille360(projets, 8)
  it('une ligne par projet, une colonne par domaine, niveau effectif = résiduel s’il est coté sinon brut', () => {
    expect(p.projets.map(x => x.id)).toEqual(['p1', 'p2', 'p3'])
    const p1 = p.projets[0]
    expect(p1.parDomaine.CYBER).toMatchObject({ count: 2, maxEffectif: 6, auDessusAppetit: 0 })   // 12 → résiduel 6 ; 4 brut
    expect(p1.parDomaine.OUTSOURCING).toMatchObject({ count: 1, maxEffectif: 9, auDessusAppetit: 1 })
    expect(p1.parDomaine.FRAUD).toMatchObject({ count: 0, maxEffectif: null })
    expect(p1.nonClasses).toBe(1)
    expect(p.projets[1].parDomaine.FRAUD).toMatchObject({ maxEffectif: 15, auDessusAppetit: 1 })
  })
  it('totaux par domaine et par projet ; projets triés avec les plus exposés en tête (hors terminés)', () => {
    expect(p.totaux.CYBER).toMatchObject({ count: 3, auDessusAppetit: 0, projetsExposes: 0 })
    expect(p.totaux.FRAUD.projetsExposes).toBe(1)
    expect(p.projets[0].auDessusAppetit).toBe(2)       // OUTSOURCING 9 + non classé 16
    expect(p.projetsTries.map(x => x.id)).toEqual(['p1', 'p3', 'p2'])  // p1 exposé, p3 sans risque, p2 terminé en dernier
    expect(p.appetit).toBe(8)
  })
  it('sans appétit défini, aucun risque n’est déclaré au-dessus', () => {
    expect(portefeuille360(projets, null).projets[0].auDessusAppetit).toBe(0)
  })
})

describe('export Excel du portefeuille', () => {
  it('feuille de synthèse (projet × domaine), neutralise les formules dans les noms de projets', async () => {
    const buf = await buildPortefeuille360Xlsx(portefeuille360([{ ...projets[0], nom: '=SOMME(A1)' }, projets[1]], 8), { lang: 'fr', now: new Date('2026-10-03T00:00:00Z'), organisation: 'Acme' })
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as never)
    expect(wb.worksheets.map(w => w.name)).toEqual(['Lisez-moi', 'Portefeuille'])
    const ws = wb.getWorksheet('Portefeuille')!
    const header = (ws.getRow(1).values as unknown[]).slice(1).map(String)
    expect(header[0]).toBe('Projet'); expect(header).toContain('CYBER'); expect(header).toContain('Au-dessus de l’appétit')
    const first = String((ws.getRow(2).values as unknown[])[1])
    expect(first.startsWith('=')).toBe(false)
  })
})
