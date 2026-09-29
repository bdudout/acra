import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { login } from './helpers'
import { E2E } from './fixtures'

// Lot L2 : éditions figées de rapports (génération, quatre-yeux, validation, figé).
test.describe('Rapports GRC', () => {
  test('générer un rapport de pertes, quatre-yeux, puis validation en mode ligne unique', async ({ page }) => {
    const prisma = new PrismaClient()
    const where = { id: E2E.orgId }
    try {
      await prisma.organizationConfig.update({ where, data: { incidentsActive: true, secondeLigneActive: true, incidentsConfig: { deviseReference: 'EUR', seuilGrandePerte: 5000 } } })
      // Isolation : un autre spec ne doit pas laisser d'incident dans l'organisation.
      await prisma.incident.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.incident.create({ data: {
        id: 'e2e_inc_rapport', organizationId: E2E.orgId, intitule: 'e2e_Incident pour rapport', declarantId: E2E.users.rssi.id, statut: 'QUALIFIE',
        dateSurvenance: new Date(), dateDetection: new Date(), montantBrut: 6000,
        pertes: [{ type: 'PERTE_DIRECTE', montant: 6000, devise: 'EUR', statut: 'ESTIME' }],
      } })
      await login(page, E2E.users.rssi.email)
      await page.goto('/rapports')
      await page.getByRole('button', { name: 'Générer un rapport' }).click()
      await page.getByLabel('Rapport', { exact: true }).selectOption('R-PER-2')
      await page.getByLabel('Période', { exact: true }).selectOption('ANNEE_COURS')
      await page.getByRole('button', { name: 'Générer le brouillon' }).click()

      // Édition en brouillon : indicateurs calculés depuis l'incident (perte brute 6 000 €, 1 grande perte).
      await expect(page.getByRole('heading', { name: 'Pertes par catégorie et par entité' })).toBeVisible()
      await expect(page.getByText('Perte brute')).toBeVisible()
      await expect(page.getByText(/6\s?000\s?€/).first()).toBeVisible()

      // Quatre-yeux : le créateur ne relit pas son propre rapport (2ᵉ ligne active).
      await page.getByRole('button', { name: 'Marquer comme relu' }).click()
      await expect(page.getByText(/ne peut pas la relire/)).toBeVisible()

      // Mode ligne unique : relecture puis validation par la même personne, tracées.
      await prisma.organizationConfig.update({ where, data: { secondeLigneActive: false } })
      await page.reload()
      await page.getByRole('button', { name: 'Marquer comme relu' }).click()
      await page.getByRole('button', { name: 'Valider (figer)' }).click()
      await expect(page.getByText('Édition figée — non recalculée')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Régénérer' })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Exporter (Excel)' })).toBeVisible()
    } finally {
      await prisma.rapportEdition.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.incident.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.organizationConfig.update({ where, data: { incidentsActive: false, secondeLigneActive: true, incidentsConfig: {} } })
      await prisma.$disconnect()
    }
  })
})
