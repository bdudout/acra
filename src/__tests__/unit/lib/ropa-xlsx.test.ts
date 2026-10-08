// Export Excel du registre des traitements (RGPD art. 30 §4 : mise à disposition de l'autorité de contrôle).
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildRopaXlsx } from '@/lib/ropa-xlsx'
import { getT } from '@/lib/i18n'

const valeurs = (ws: ExcelJS.Worksheet, n: number) => (ws.getRow(n).values as unknown[]).slice(1)

describe('buildRopaXlsx', () => {
  it('présentation (organisation, date) puis une ligne par traitement : champs de l’art. 30, complétude et AIPD en clair ; formule neutralisée', async () => {
    const buf = await buildRopaXlsx({
      t: getT('fr'), now: new Date('2026-10-09T10:00:00Z'), organisation: 'Banque Exemple',
      traitements: [{
        nom: '=HYPERLINK("x")', finalite: 'Suivi médical', baseLegale: 'obligation_legale', categoriesPersonnes: ['Salariés'], categoriesDonnees: ['Données de santé'],
        destinataires: ['Médecin du travail'], transfertHorsUE: true, paysTransfert: 'Suisse', garantiesTransfert: '', dureeConservation: '50 ans', mesuresSecurite: ['Chiffrement', 'Habilitations'],
        evaluation: { complet: false, champsManquants: ['garantiesTransfert'], pia: { requis: true, motifs: ['donnees_sensibles_art9'] } },
      }],
    })
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as unknown as ArrayBuffer)
    expect(wb.worksheets.map(w => w.name)).toEqual(['Présentation', 'Registre (art. 30)'])
    expect(valeurs(wb.worksheets[0], 2)).toEqual(['Organisation', 'Banque Exemple'])
    const entetes = valeurs(wb.worksheets[1], 1)
    expect(entetes).toEqual(expect.arrayContaining(['Nom du traitement', 'Finalité', 'Base légale', 'Catégories de personnes', 'Catégories de données', 'Destinataires', 'Transfert hors UE', 'Pays de transfert', 'Garanties (art. 44-46)', 'Durée de conservation', 'Mesures de sécurité', 'Complet (art. 30)', 'Champs manquants', 'AIPD requise', 'Motifs']))
    const l = valeurs(wb.worksheets[1], 2)
    expect(String(l[0]).startsWith('=')).toBe(false) // formule neutralisée
    expect(l).toEqual(expect.arrayContaining(['Obligation légale', 'Salariés', 'Données de santé', 'Oui', 'Suisse', 'Chiffrement, Habilitations', 'Non', 'Garanties (art. 44-46)', 'Catégories particulières de données à caractère personnel (art. 9)']))
  })
})
