import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { login } from './helpers'
import { E2E } from './fixtures'

// Lot L1 : régimes de notification configurables, pertes multi-composantes.
test.describe('Incidents — régimes de notification et pertes', () => {
  test('un incident significatif affiche l’horloge NIS2 ; marquer l’alerte précoce soumise ; pertes par composantes', async ({ page }) => {
    const prisma = new PrismaClient()
    const where = { id: E2E.orgId }
    try {
      await prisma.organizationConfig.update({ where, data: { incidentsActive: true, incidentsConfig: { deviseReference: 'EUR', seuilGrandePerte: 5000, regimes: [{ code: 'NIS2', actif: true }] } } })
      await login(page, E2E.users.rssi.email)
      await page.goto('/incidents')
      await page.getByRole('button', { name: '+ Déclarer un incident' }).click()
      await page.getByPlaceholder('Que s\'est-il passé ?').fill('e2e_Rançongiciel SI de paie')
      await page.getByLabel('Type d’événement').selectOption('CYBER')
      await page.getByLabel('Incident significatif / important').check()
      await page.getByRole('button', { name: 'Déclarer', exact: true }).click()

      // Horloge NIS2 : une échéance par phase, 3 phases, alerte précoce à faire.
      const ligne = page.getByRole('row', { name: /e2e_Rançongiciel/ })
      await expect(ligne).toBeVisible()
      await ligne.getByRole('button', { name: /Notifications à suivre|Notifications/ }).first().click()
      await expect(page.getByText('NIS2 — Directive (UE) 2022/2555, art. 23')).toBeVisible()
      await expect(page.getByText('Alerte précoce')).toBeVisible()
      await page.getByLabel('Référence de l’accusé (facultatif)').first().fill('E2E-1')
      await page.getByRole('button', { name: 'Marquer comme soumise' }).first().click()
      await expect(page.getByText(/E2E-1/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Annuler la soumission' })).toBeVisible()
      await page.locator('div.fixed button[aria-label="Annuler"]').click()

      // Pertes par composantes : 6 000 € de perte directe => « Grande perte » (seuil 5 000).
      await ligne.getByRole('button', { name: 'Qualifier' }).click()
      await page.getByLabel('Catégorie').selectOption({ index: 1 })
      await page.getByRole('button', { name: 'Ajouter une perte' }).click()
      await page.getByLabel('Montant — perte 1').fill('6000')
      await page.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(page.getByText('Grande perte').first()).toBeVisible()
    } finally {
      await prisma.organizationConfig.update({ where, data: { incidentsActive: false, incidentsConfig: {} } })
      await prisma.$disconnect()
    }
  })
})
