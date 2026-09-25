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
    const input = page.locator('input[accept=".xlsx"]')
    await input.setInputFiles({ name: 'historique.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await historicWorkbook() })
    await expect(page.getByRole('region', { name: 'Préparer l’import Excel' })).toBeVisible()
    await expect(page.getByLabel('Risques — Intitulé')).toHaveValue('Libellé de risque')
    await expect(page.getByLabel('Vulnérabilités — Référence risque')).toHaveValue('Référence risque')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Importer les données validées' }).click()
    await expect(page.getByText('historique', { exact: false })).toBeVisible()
  })
})
