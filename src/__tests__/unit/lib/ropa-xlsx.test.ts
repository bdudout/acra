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
      identite: { responsable: { nom: 'Banque Exemple SA', adresse: '1 rue X, Paris', contact: 'contact@banque.fr' }, representant: { nom: '', contact: '' }, dpo: { source: 'DESIGNE', nom: 'Alice Martin', contact: 'alice@x.fr' }, manquants: [] },
      traitements: [{
        nom: '=HYPERLINK("x")', finalite: 'Suivi médical', baseLegale: 'obligation_legale', categoriesPersonnes: ['Salariés'], categoriesDonnees: ['Données de santé'],
        destinataires: ['Médecin du travail'], transfertHorsUE: true, paysTransfert: 'Suisse', garantiesTransfert: '', dureeConservation: '50 ans', mesuresSecurite: ['Chiffrement', 'Habilitations'],
        evaluation: { complet: false, champsManquants: ['garantiesTransfert'], pia: { requis: true, niveau: 'REQUISE', motifs: ['DONNEES_SENSIBLES', 'GRANDE_ECHELLE'] } },
      }],
    })
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as unknown as ArrayBuffer)
    expect(wb.worksheets.map(w => w.name)).toEqual(['Présentation', 'Registre (art. 30)'])
    expect(valeurs(wb.worksheets[0], 2)).toEqual(['Organisation', 'Banque Exemple'])
    // Identité (art. 30 §1 a) : responsable et DPO.
    const pres = [3, 4, 5, 6, 7, 8].map(n => valeurs(wb.worksheets[0], n))
    expect(pres).toEqual(expect.arrayContaining([['Responsable du traitement', 'Banque Exemple SA'], ['Coordonnées du responsable', '1 rue X, Paris — contact@banque.fr'], ['Délégué à la protection des données', 'Alice Martin — alice@x.fr']]))
    const entetes = valeurs(wb.worksheets[1], 1)
    expect(entetes).toEqual(expect.arrayContaining(['Nom du traitement', 'Finalité', 'Base légale', 'Catégories de personnes', 'Catégories de données', 'Destinataires', 'Transfert hors UE', 'Pays de transfert', 'Garanties (art. 44-46)', 'Durée de conservation', 'Mesures de sécurité', 'Complet (art. 30)', 'Champs manquants', 'AIPD', 'Critères WP248']))
    const l = valeurs(wb.worksheets[1], 2)
    expect(String(l[0]).startsWith('=')).toBe(false) // formule neutralisée
    expect(l).toEqual(expect.arrayContaining(['Obligation légale', 'Salariés', 'Données de santé', 'Oui', 'Suisse', 'Chiffrement, Habilitations', 'Non', 'Garanties (art. 44-46)', 'AIPD requise', 'Données sensibles ou données à caractère hautement personnel ; Données traitées à grande échelle']))
  })
})
