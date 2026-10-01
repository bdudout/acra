import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { login } from './helpers'
import { E2E } from './fixtures'

// Lot L5 : vocabulaire de l'organisation (affichage), champs personnalisés (requis, restreints par rôle).
test.describe('Personnalisation — L5', () => {
  test('vocabulaire renommé à l’affichage, champ requis exigé, champ réservé masqué', async ({ page }) => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
    const where = { id: E2E.orgId }
    try {
      await prisma.incident.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.organizationConfig.update({ where, data: {
        incidentsActive: true,
        vocabulaire: { incident: { '*': 'Événements de sécurité' } },
        champsPersonnalises: { incident: [
          { code: 'ticket', label: 'Ticket ITSM', type: 'TEXTE', requis: true },
          { code: 'note_admin', label: 'Note réservée administrateur', type: 'TEXTE', roles: ['ADMIN'] },
        ] },
      } })
      await login(page, E2E.users.rssi.email)
      await page.goto('/incidents')
      await expect(page.getByRole('heading', { name: 'Événements de sécurité' })).toBeVisible()

      await page.getByRole('button', { name: '+ Déclarer un incident' }).click()
      await page.getByPlaceholder('Que s\'est-il passé ?').fill('e2e_Incident champs personnalisés')
      // Champ réservé à l'ADMIN : absent pour le RSSI ; champ requis : présent.
      await expect(page.getByLabel('Ticket ITSM *')).toBeVisible()
      await expect(page.getByLabel('Note réservée administrateur')).toHaveCount(0)

      await page.getByRole('button', { name: 'Déclarer', exact: true }).click()
      await expect(page.getByText(/champs personnalisés obligatoires/)).toBeVisible()

      await page.getByLabel('Ticket ITSM *').fill('INC-4242')
      await page.getByRole('button', { name: 'Déclarer', exact: true }).click()
      await expect(page.getByRole('row', { name: /e2e_Incident champs personnalisés/ })).toBeVisible()
      const saved = await prisma.incident.findFirst({ where: { organizationId: E2E.orgId, intitule: 'e2e_Incident champs personnalisés' }, select: { champs: true } })
      expect(saved?.champs).toEqual({ ticket: 'INC-4242' })
    } finally {
      await prisma.incident.deleteMany({ where: { organizationId: E2E.orgId } })
      await prisma.organizationConfig.update({ where, data: { incidentsActive: false, vocabulaire: {}, champsPersonnalises: {} } })
      await prisma.$disconnect()
    }
  })
})
