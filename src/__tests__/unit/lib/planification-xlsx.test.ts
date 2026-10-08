// Exports Excel du programme d'audit et de contrôle (lot P6) : un plan (une feuille par année, cibles nommées, statut,
// réalisations, validations) et la vue globale ; textes neutralisés contre l'injection de formules.
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildPlanXlsx, buildVueXlsx } from '@/lib/planification-xlsx'
import { fr } from '@/lib/i18n/fr'

const lire = async (buf: Buffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as unknown as ArrayBuffer); return wb }
const valeurs = (ws: ExcelJS.Worksheet, n: number) => (ws.getRow(n).values as unknown[]).slice(1)

describe('buildPlanXlsx', () => {
  it('présentation, une feuille par année avec cibles nommées et statut, validations ; formule neutralisée', async () => {
    const buf = await buildPlanXlsx({
      t: fr, now: new Date('2026-10-08T00:00:00Z'), organisation: 'Mutuelle',
      plan: { nom: 'Audit SI', type: 'AUDIT', equipe: 'Audit IT', prismePrincipal: 'REFERENTIEL', mode: 'FIGE', anneeDebut: 2027, anneeFin: 2027 },
      annees: [{ annee: 2027, statut: 'VALIDE', valideLe: '2026-12-12T10:00:00Z', revision: 1, motifRevision: 'Acquisition', commentaire: 'Comité' }],
      lignes: [{ annee: 2027, intitule: '=CMD()', prisme: 'REFERENTIEL', cibles: { organisations: ['f1'], entites: ['e1'], tiers: [], risques: ['r1'], processus: [], referentiel: { code: 'ISO27001', exigences: ['A.5.15'] } }, echantillon: { methode: 'RISQUE', population: 40, taille: 8 }, debut: '2027-03-01', fin: '2027-03-31', charge: 12, priorite: 1, responsable: 'Équipe', statutCalcule: 'A_VENIR', realisations: [{ intitule: 'Audit accès' }] }],
      noms: { f1: 'Filiale Nord', e1: 'Direction des SI', r1: 'Fraude' },
    })
    const wb = await lire(buf)
    expect(wb.worksheets.map(w => w.name)).toEqual(['Audit SI', '2027', 'Historique'])
    const an = wb.getWorksheet('2027')!
    expect(valeurs(an, 1)[0]).toBe('Intitulé')
    const l = valeurs(an, 2)
    expect(l[0]).toBe("'=CMD()")
    expect(l).toEqual(expect.arrayContaining(['Filiale Nord', 'Direction des SI', 'Fraude', 'ISO27001 : A.5.15', 'Selon le risque · 8/40', 'À venir', 'Audit accès', 'Très haute']))
    expect(valeurs(wb.getWorksheet('Historique')!, 2)).toEqual(expect.arrayContaining([2027, 'Validé', 1, 'Acquisition']))
  })
})

describe('buildVueXlsx', () => {
  it('synthèse, lignes de l’année, sollicitations et angles morts', async () => {
    const buf = await buildVueXlsx({
      t: fr, now: new Date('2026-10-08T00:00:00Z'), organisation: 'Mutuelle', annee: 2027, seuil: 3,
      plans: [{ nom: 'Audit SI', type: 'AUDIT', statut: 'VALIDE', lignes: 2, realisation: { actives: 2, realisees: 1, enRetard: 0, taux: 50 } }],
      lignes: [{ planNom: 'Audit SI', intitule: 'Accès', debut: '2027-03-01', fin: null, statutManuel: null }],
      sollicitations: { organisations: [{ nom: 'Filiale Nord', nombre: 2, plans: 2, simultanee: true }], entites: [{ nom: 'Direction des SI', nombre: 3, plans: 2, simultanee: false }], tiers: [] },
      anglesMorts: { risques: [{ nom: 'Fraude', niveau: 12, derniere: null, prevu: true }], processus: [] },
    })
    const wb = await lire(buf)
    expect(wb.worksheets.length).toBe(4)
    expect(valeurs(wb.worksheets[0], 2)).toEqual(expect.arrayContaining(['Audit SI', 'Validé', 2, 50]))
    expect(valeurs(wb.worksheets[2], 2)).toEqual(expect.arrayContaining(['Filiale Nord', 2, 'Oui']))
    expect(valeurs(wb.worksheets[2], 3)).toEqual(['Entités du référentiel', 'Direction des SI', 3, 2, 'Non'])
    expect(valeurs(wb.worksheets[3], 2)).toEqual(expect.arrayContaining(['Fraude', 12, 'jamais', 'Oui']))
  })
})
