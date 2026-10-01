import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { login } from './helpers'
import { E2E } from './fixtures'

// Lot L4 : suivi des recommandations par l'audité, univers d'audit, rapport de suivi.
// NB : l'audité (RSSI) déclare la réalisation ; la vérification par l'audit est couverte par les tests
// de route (le seed E2E n'a pas d'utilisateur AUDITEUR).
test.describe('Audit interne — L4', () => {
  test('l’audité déclare une recommandation réalisée, l’univers apparaît au plan, le rapport de suivi la liste', async ({ page }) => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
    const where = { id: E2E.orgId }
    try {
      await prisma.auditConstat.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.auditMission.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.auditUnivers.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.organizationConfig.update({ where, data: { auditInterneActive: true } })
      const mission = await prisma.auditMission.create({ data: { organizationId: E2E.orgId, intitule: 'e2e_Mission paiements', statut: 'EN_COURS' } })
      await prisma.auditConstat.create({ data: {
        organizationId: E2E.orgId, missionId: mission.id, intitule: 'e2e_Revue des accès absente', criticite: 3, statut: 'EN_COURS',
        critere: 'Politique d’accès §4', cause: 'Turn-over', consequence: 'Comptes orphelins', echeance: new Date(Date.now() + 30 * 86_400_000),
      } })
      await prisma.auditUnivers.create({ data: { organizationId: E2E.orgId, intitule: 'e2e_Paiements en ligne', type: 'PROCESSUS', risque: 4 } })

      await login(page, E2E.users.rssi.email)
      await page.goto('/audit')
      await page.getByText('e2e_Mission paiements').click()
      await expect(page.getByText('e2e_Revue des accès absente')).toBeVisible()
      await page.getByRole('button', { name: 'Suivi', exact: true }).first().click()
      await expect(page.getByText('Politique d’accès §4')).toBeVisible()
      await page.getByRole('button', { name: 'Déclarer réalisée' }).click()
      await expect(page.getByText('Réalisée').first()).toBeVisible()

      // Univers d'audit : jamais audité → à traiter dès l'année en cours.
      await page.goto('/audit/plan')
      await expect(page.getByRole('heading', { name: 'Univers et plan d’audit' })).toBeVisible()
      await expect(page.getByText('e2e_Paiements en ligne').first()).toBeVisible()
      await expect(page.getByText('Jamais audité').first()).toBeVisible()

      // Rapport R-AUD-3 : la recommandation réalisée compte dans le taux de mise en œuvre.
      await page.goto('/rapports')
      await page.getByRole('button', { name: 'Générer un rapport' }).click()
      await page.getByLabel('Rapport', { exact: true }).selectOption('R-AUD-3')
      await page.getByRole('button', { name: 'Générer le brouillon' }).click()
      await expect(page.getByRole('heading', { name: 'Suivi des recommandations' })).toBeVisible()
      await expect(page.getByText('Taux de mise en œuvre')).toBeVisible()
    } finally {
      await prisma.rapportEdition.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.auditConstat.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.auditMission.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.auditUnivers.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.organizationConfig.update({ where, data: { auditInterneActive: false } })
      await prisma.$disconnect()
    }
  })
})
