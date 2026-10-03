// @vitest-environment node
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildDeclarationWorkbook } from '@/lib/incident-declaration-xlsx'
import type { DeclarationIncident } from '@/lib/incident-declaration'

const incident: DeclarationIncident = {
  id: 'inc1', intitule: '=cmd|\' /C calc\'!A0 Panne du SI', description: 'Indisponibilité', dateSurvenance: new Date('2026-10-05T06:30:00Z'), dateDetection: new Date('2026-10-05T07:00:00Z'),
  doraClasseMajeurLe: new Date('2026-10-05T09:00:00Z'), doraCriteres: { clientsAffectes: 5000, serviceCritique: true }, statut: 'QUALIFIE',
}
const ctx = { organisationNom: 'Banque Exemple', devise: 'EUR', now: new Date('2026-10-08T00:00:00Z') }
const load = async (buf: ArrayBuffer | Buffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as ArrayBuffer); return wb }

describe('buildDeclarationWorkbook — DORA', () => {
  it('feuille de lecture + feuille de l’étape : une ligne par champ, valeur, statut, valeurs admises ; injection de formule neutralisée', async () => {
    const buf = await buildDeclarationWorkbook({ kind: 'DORA', stage: 'INITIAL', declaration: { '2.7': 'staff' } }, incident, ctx, 'fr')
    const wb = await load(buf)
    expect(wb.worksheets.map(w => w.name)).toEqual(['Lisez-moi', 'Notification initiale'])
    const ws = wb.getWorksheet('Notification initiale')!
    const head = ws.getRow(1).values as unknown[]
    expect(head.slice(1)).toEqual(['N°', 'Champ', 'Type', 'Obligatoire', 'Condition', 'Valeur', 'Statut', 'Valeurs admises'])
    expect(ws.rowCount).toBe(1 + 25)
    const row = (id: string) => { for (let r = 2; r <= ws.rowCount; r++) if (ws.getRow(r).getCell(1).value === id) return ws.getRow(r); throw new Error(id) }
    expect(row('2.7').getCell(6).value).toBe('staff'); expect(row('2.7').getCell(7).value).toBe('Renseigné')
    expect(String(row('2.5').getCell(6).value)).toContain('critical services affected'); expect(String(row('2.5').getCell(8).value)).toContain('economic impact')
    expect(row('2.9').getCell(7).value).toBe('À compléter'); expect(row('2.8').getCell(7).value).toBe('À examiner (conditionnel)')
    expect(String(row('2.4').getCell(6).value).startsWith('\'=')).toBe(true) // « =cmd… » préfixé : jamais une formule
    const readme = wb.getWorksheet('Lisez-moi')!
    const text = readme.getSheetValues().flat().map(v => String(v ?? '')).join(' | ')
    expect(text).toContain('2025/302'); expect(text).toContain('ACPR'); expect(text).toContain('Banque Exemple')
  })
  it('libellés dans la langue demandée (en) ; étape finale : champs 1 à 4', async () => {
    const wb = await load(await buildDeclarationWorkbook({ kind: 'DORA', stage: 'FINAL', declaration: {} }, incident, ctx, 'en'))
    const ws = wb.getWorksheet('Final report')!
    expect((ws.getRow(1).values as unknown[]).slice(1, 4)).toEqual(['No.', 'Field', 'Type']); expect(ws.rowCount).toBe(1 + 76)
  })
})

describe('buildDeclarationWorkbook — autres régimes', () => {
  it('feuille unique : régime, autorité, phase, échéance, état de la déclaration, faits de l’incident', async () => {
    const wb = await load(await buildDeclarationWorkbook({ kind: 'REGIME', code: 'CRA_14', label: 'CRA — Règlement (UE) 2024/2847', autorite: 'CSIRT', phase: { code: 'ALERTE_PRECOCE', label: 'Alerte précoce (24 h)' }, echeance: new Date('2026-10-06T07:00:00Z'), soumisLe: null }, incident, ctx, 'fr'))
    expect(wb.worksheets.map(w => w.name)).toEqual(['Lisez-moi', 'Déclaration'])
    const rows = wb.getWorksheet('Déclaration')!.getSheetValues().filter(Boolean).map(r => (r as unknown[]).slice(1).map(String).join(' = '))
    expect(rows.join('\n')).toContain('CRA_14'); expect(rows.join('\n')).toContain('2026-10-06T07:00:00Z'); expect(rows.join('\n')).toContain('Banque Exemple'); expect(rows.join('\n')).toContain('Non déposée')
  })
})

describe('buildDeclarationWorkbook — RGPD art. 33 § 3', () => {
  it('ajoute une feuille avec les rubriques de l’art. 33 § 3 (valeurs saisies, « à compléter » sinon) pour RGPD_33 seulement', async () => {
    const base = { kind: 'REGIME' as const, code: 'RGPD_33', phase: { code: 'NOTIFICATION' }, echeance: null, soumisLe: null }
    const wb = await load(await buildDeclarationWorkbook({ ...base, declaration: { 'rgpd.nature': 'Envoi à un mauvais destinataire', 'rgpd.nbPersonnes': 40 } }, incident, ctx, 'fr'))
    expect(wb.worksheets.map(w => w.name)).toEqual(['Lisez-moi', 'Déclaration', 'RGPD art. 33 § 3'])
    const rows = wb.getWorksheet('RGPD art. 33 § 3')!.getSheetValues().filter(Boolean).map(r => (r as unknown[]).slice(1).map(String).join(' | ')).join('\n')
    expect(rows).toContain('Envoi à un mauvais destinataire'); expect(rows).toContain('40'); expect(rows).toContain('À compléter')
    const other = await load(await buildDeclarationWorkbook({ ...base, code: 'NIS2' }, incident, ctx, 'fr'))
    expect(other.worksheets).toHaveLength(2)
  })
})
