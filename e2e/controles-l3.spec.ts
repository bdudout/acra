import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { login } from './helpers'
import { E2E } from './fixtures'

// Lot L3 : typologie, conception, plan annuel, rapport d'efficacité du dispositif.
test.describe('Contrôle permanent — L3', () => {
  test('contrôle clé automatique, conception inadéquate, plan annuel et rapport d’efficacité', async ({ page }) => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
    const where = { id: E2E.orgId }
    try {
      await prisma.controle.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.organizationConfig.update({ where, data: { controlePermanentActive: true } })
      await login(page, E2E.users.rssi.email)
      await page.goto('/controles')
      await page.getByRole('button', { name: '+ Nouveau contrôle' }).click()
      await page.getByPlaceholder('Intitulé du contrôle').fill('e2e_Revue des accès privilégiés')
      await page.getByLabel('Type de contrôle').selectOption('PREVENTIF')
      await page.getByLabel('Mode d’exécution').selectOption('AUTOMATIQUE')
      await page.getByLabel('Contrôle clé').check()
      await page.getByRole('button', { name: 'Créer' }).click()

      const ligne = page.getByRole('row', { name: /e2e_Revue des accès privilégiés/ })
      await expect(ligne).toBeVisible()
      await expect(ligne.getByText('Contrôle clé')).toBeVisible()
      await expect(ligne.getByText('Automatique')).toBeVisible()

      // Conception évaluée indépendamment de l'exécution : « Inadéquate » → contrôle défaillant.
      await ligne.getByRole('button', { name: /Jamais exécuté/i }).click()
      await page.getByLabel('Conception du contrôle').selectOption('INADEQUATE')
      await page.getByLabel('Commentaire de conception').fill('Ne couvre pas les comptes de service')
      await page.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(ligne.getByText('Défaillant')).toBeVisible()

      // Plan annuel : une pastille par période, le contrôle mensuel apparaît.
      await page.goto('/controles/plan')
      await expect(page.getByRole('heading', { name: 'Plan annuel des contrôles' })).toBeVisible()
      await expect(page.getByText('e2e_Revue des accès privilégiés')).toBeVisible()

      // Rapport R-CTL-2 : le contrôle clé est détaillé avec sa conception.
      await page.goto('/rapports')
      await page.getByRole('button', { name: 'Générer un rapport' }).click()
      await page.getByLabel('Rapport', { exact: true }).selectOption('R-CTL-2')
      await page.getByLabel('Période', { exact: true }).selectOption('ANNEE_COURS')
      await page.getByRole('button', { name: 'Générer le brouillon' }).click()
      await expect(page.getByRole('heading', { name: 'Efficacité du dispositif de contrôle' })).toBeVisible()
      await expect(page.getByText('e2e_Revue des accès privilégiés')).toBeVisible()
      await expect(page.getByText('Inadéquate').first()).toBeVisible()
    } finally {
      await prisma.rapportEdition.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.controle.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.organizationConfig.update({ where, data: { controlePermanentActive: false } })
      await prisma.$disconnect()
    }
  })
})
