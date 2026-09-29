import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { E2E } from './fixtures'
import ExcelJS from 'exceljs'

async function historicWorkbook() {
  const workbook = new ExcelJS.Workbook()
  const risks = workbook.addWorksheet('Risques')
  risks.addRow(['Référence risque', 'Libellé de risque', 'Gravité', 'Probabilité'])
  risks.addRow(['E2E-R-1', 'Indisponibilité du service', 3, 2])
  const vulnerabilities = workbook.addWorksheet('Vulnérabilités')
  vulnerabilities.addRow(['Référence risque', 'Libellé vulnérabilité'])
  vulnerabilities.addRow(['E2E-R-1', 'Sauvegardes non testées'])
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

test.describe('Import d’analyses historiques', () => {
  test('un analyste accède aux quatre parcours depuis la liste des analyses', async ({ page }) => {
    await login(page, E2E.users.porteur.email)
    await page.goto('/analyses')
    await page.getByRole('button', { name: 'Importer' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByText('Export ACRA')).toBeVisible()
    await expect(page.getByText('Excel historique')).toBeVisible()
    await expect(page.getByText('API / intégration')).toBeVisible()
    await expect(page.getByText('MCP assisté')).toBeVisible()
  })

  test('prévisualise un classeur multi-feuilles avec son mapping automatique', async ({ page }) => {
    await login(page, E2E.users.porteur.email)
    await page.goto('/analyses')
    await page.getByRole('button', { name: 'Importer' }).click()
    const input = page.locator('input[accept^=".xlsx"]')
    await input.setInputFiles({ name: 'historique.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await historicWorkbook() })
    await expect(page.getByRole('region', { name: 'Préparer l’import Excel' })).toBeVisible()
    await expect(page.getByLabel('Risques — Intitulé')).toHaveValue('Libellé de risque')
    await expect(page.getByLabel('Vulnérabilités — Référence risque')).toHaveValue('Référence risque')
    await page.getByRole('button', { name: 'Importer les données validées' }).click()
    const report = page.getByRole('dialog', { name: 'Bilan de l’import' })
    await expect(report).toBeVisible()
    await expect(report.getByText('historique', { exact: true })).toBeVisible()
  })

  test('importe les trois formats de recette : minimal, consultant et multi-feuilles', async ({ page }) => {
    await login(page, E2E.users.porteur.email)
    const scenarios: Array<{ name: string; sheets: Array<[string, Array<Array<string | number>>]>; role: 'RISKS' | 'MEASURES' }> = [
      { name: 'minimal.xlsx', sheets: [['Registre risques', [['Code risque', 'Libellé risque', 'Impact', 'Probabilité'], ['R-1', 'Risque minimal', 3, 2]]]], role: 'RISKS' },
      { name: 'consultant.xlsx', sheets: [['Dispositifs', [['ID', 'Mesure', 'État cabinet'], ['M-1', 'Tester PRA', 'Terminé']]]], role: 'MEASURES' },
      { name: 'multi.xlsx', sheets: [['Risques', [['Référence risque', 'Intitulé', 'Gravité', 'Vraisemblance'], ['R-2', 'Risque multi', 3, 2]]], ['Plans actions', [['Action ID', 'Référence risque', 'Intitulé action'], ['A-2', 'R-2', 'Action multi']]]], role: 'RISKS' },
    ]
    for (const scenario of scenarios) {
      const workbook = new ExcelJS.Workbook()
      scenario.sheets.forEach(([name, rows]) => { const sheet = workbook.addWorksheet(name); rows.forEach(row => sheet.addRow(row)) })
      await page.goto('/analyses'); await page.getByRole('button', { name: 'Importer' }).click()
      await page.locator('input[accept^=".xlsx"]').setInputFiles({ name: scenario.name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) })
      if (scenario.role === 'MEASURES') { await page.getByLabel('Dispositifs — Utiliser cette feuille comme').selectOption('MEASURES'); await page.getByLabel('Dispositifs — Intitulé', { exact: true }).selectOption('Mesure') }
      const submit = page.getByRole('button', { name: 'Importer les données validées' }); await expect(submit).toBeEnabled(); await submit.click()
      const report = page.getByRole('dialog', { name: 'Bilan de l’import' })
      await expect(report).toBeVisible()
      await expect(report.getByText(scenario.name.replace('.xlsx', ''), { exact: true })).toBeVisible()
    }
  })
})
