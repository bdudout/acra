// Lot T2 — export Excel des évaluations d'usages de services tiers : une ligne par usage (organisation, ou groupe pour
// une tête de groupe), libellés dans la langue demandée, cellules neutralisées contre l'injection de formule.
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildTierEvaluationWorkbook, type LigneExportTiers } from '@/lib/tier-evaluation-xlsx'

const lignes: LigneExportTiers[] = [
  { tiers: '=HYPERLINK("http://x")', offre: 'IaaS', organisation: 'Filiale Nord', usage: 'Hébergement de la paie', processus: 'Paie', criticite: 'CRITIQUE', statut: 'VALIDEE',
    actuelle: { menace: 3, zone: 'danger' }, cible: { menace: 8 / 9, zone: 'veille' }, prochaine: '2027-10-10', clauses: ['securite', 'reversibilite'] },
  { tiers: 'Éditeur', offre: 'SaaS RH', organisation: 'Filiale Nord', usage: 'Paie', processus: null, criticite: null, statut: null, actuelle: null, cible: null, prochaine: null, clauses: [] },
]
const load = async (buf: Buffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as unknown as ArrayBuffer); return wb }

describe('buildTierEvaluationWorkbook', () => {
  it('une ligne par usage, menace arrondie et zone, statut et clauses lisibles ; formule neutralisée', async () => {
    const ws = (await load(await buildTierEvaluationWorkbook(lignes, 'fr'))).worksheets[0]
    expect(ws.name).toBe('Évaluation des tiers')
    expect((ws.getRow(1).values as unknown[]).slice(1, 4)).toEqual(['Tiers', 'Offre', 'Organisation'])
    const r2 = (ws.getRow(2).values as unknown[]).slice(1).map(String)
    expect(r2[0].startsWith("'=")).toBe(true)
    expect(r2).toEqual(expect.arrayContaining(['Hébergement de la paie', 'Critique', 'Validée', '3', 'Danger', '0.89', 'Veille', '2027-10-10', 'Clauses de sécurité ; Annexe de réversibilité']))
    const r3 = (ws.getRow(3).values as unknown[]).slice(1).map(String)
    expect(r3).toEqual(expect.arrayContaining(['Non évalué']))
  })
  it('anglais : en-têtes et valeurs traduits', async () => {
    const ws = (await load(await buildTierEvaluationWorkbook(lignes, 'en'))).worksheets[0]
    expect(ws.name).toBe('Third-party assessment')
    expect((ws.getRow(2).values as unknown[]).map(String)).toEqual(expect.arrayContaining(['Approved', 'Danger', 'Security clauses ; Reversibility annex']))
  })
})
