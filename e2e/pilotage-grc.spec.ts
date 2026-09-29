import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { login } from './helpers'
import { E2E } from './fixtures'

// Régression : /pilotage renvoyait vers /dashboard quand le module registre était
// inactif alors que la barre proposait « Pilotage » (autre module GRC actif).
test.describe('Cockpit GRC', () => {
  test('reste accessible avec un seul module GRC (contrôle permanent) et suit les projets 360', async ({ page }) => {
    const prisma = new PrismaClient()
    const where = { id: E2E.orgId }
    try {
      await prisma.organizationConfig.update({ where, data: { registreRisquesActive: false, controlePermanentActive: true, projets360Active: true } })
      await login(page, E2E.users.rssi.email)
      await page.goto('/pilotage')
      await expect(page).toHaveURL(/\/pilotage$/)
      await expect(page.getByRole('heading', { name: 'Suivi des projets 360' })).toBeVisible()
    } finally {
      await prisma.organizationConfig.update({ where, data: { controlePermanentActive: false } })
      await prisma.$disconnect()
    }
  })
})
