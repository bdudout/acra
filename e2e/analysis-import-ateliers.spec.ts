import { test, expect } from '@playwright/test'
import ExcelJS from 'exceljs'
import { login } from './helpers'
import { E2E } from './fixtures'

// Dossier EBIOS RM minimal : valeurs métier, événements redoutés (liens VM02 / VM_02), sources regroupées, risques et mesures.
async function dossier() {
  const wb = new ExcelJS.Workbook()
  const vm = wb.addWorksheet('1 - Valeurs Métiers')
  vm.addRow(['Réf.VM', 'Dénomination', 'Description'])
  vm.addRow(['VM_01', 'Planification des chantiers', 'Planning'])
  vm.addRow(['VM_02', 'Pointage des heures', 'Heures et présences'])
  vm.addRow(['VM_03'])
  const er = wb.addWorksheet('1 - Événements redoutés')
  er.addRow(['Réf.ER', 'Intitulés des événements redoutés', 'Gravité', 'Valeur(s) Métier(s) liée(s)', 'Retenu ?'])
  er.addRow(['ER_01', 'Divulgation des données du personnel', '3 - Importante', 'VM02, VM_01', 'Oui'])
  er.addRow(['ER_02', 'Événement écarté', '2 - Limitée', 'VM_01', 'Non'])
  const sr = wb.addWorksheet('1 - SROV')
  sr.addRow(['Réf.SR/OV', 'Sources de risques', 'Objectifs visés', 'Motivation', 'Ressources', 'Retenu ?'])
  sr.addRow(['SR/OV_01', 'Etat', 'Espionnage', '+ +', '+ + +', 'Non'])
  sr.addRow(['SR/OV_02', 'Etat', 'Influence', '+ +', '+ + +', 'Non'])
  sr.addRow(['SR/OV_03', 'Crime organisé', 'Lucratif', '+ + +', '+ +', 'Oui'])
  const ri = wb.addWorksheet('5 - Risques initiaux')
  ri.addRow(['Réf.RI', 'Gravité initiale', 'Vraisemblance initiale', 'Description du risque'])
  ri.addRow(['RI_01', '3 - Importante', '2 - Vraisemblable', 'Usurpation du compte d’un conducteur de travaux'])
  return Buffer.from(await wb.xlsx.writeBuffer())
}

test.describe('Import d’un dossier EBIOS RM (ateliers 1 à 5)', () => {
  test('les rôles des feuilles sont reconnus et les ateliers sont créés', async ({ page }) => {
    await login(page, E2E.users.porteur.email)
    await page.goto('/analyses')
    await page.getByRole('button', { name: 'Importer' }).click()
    await page.locator('input[accept^=".xlsx"]').setInputFiles({ name: 'e2e_ateliers.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await dossier() })
    await expect(page.getByRole('region', { name: 'Préparer l’import Excel' })).toBeVisible()
    await expect(page.getByLabel('1 - Valeurs Métiers — Utiliser cette feuille comme')).toHaveValue('BUSINESS_VALUES')
    await expect(page.getByLabel('1 - Événements redoutés — Utiliser cette feuille comme')).toHaveValue('FEARED_EVENTS')
    await expect(page.getByLabel('1 - SROV — Utiliser cette feuille comme')).toHaveValue('RISK_SOURCES')
    await page.getByRole('button', { name: 'Importer les données validées' }).click()
    await expect(page.getByRole('dialog', { name: 'Bilan de l’import' })).toBeVisible()

    // Vérification par l'API : le cadrage porte les valeurs métier (ligne modèle ignorée) et l'événement retenu lié à ses deux valeurs.
    const liste = await (await page.request.get('/api/analyses')).json()
    const analyse = (liste.analyses as { id: string; nom: string }[]).find(a => a.nom === 'e2e_ateliers')
    expect(analyse).toBeTruthy()
    const detail = await (await page.request.get(`/api/analyses/${analyse!.id}`)).json()
    const a = detail.analyse ?? detail
    expect(a.cadrage.valeursMetier.map((v: { nom: string }) => v.nom)).toEqual(['Planification des chantiers', 'Pointage des heures'])
    expect(a.cadrage.evenementsRedoutes).toHaveLength(1)
    expect(a.cadrage.evenementsRedoutes[0]).toMatchObject({ gravite: 3 })
    expect(a.sourcesRisque.map((s: { nom: string }) => s.nom)).toEqual(['Etat', 'Crime organisé'])
    expect(a.sourcesRisque[0].objectifsVises).toHaveLength(2)
    expect(a.risques).toHaveLength(1)

    // Nettoyage : les spécifications partagent une organisation.
    await page.request.delete(`/api/analyses/${analyse!.id}`)
  })
})
