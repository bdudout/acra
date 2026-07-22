import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { E2E } from './fixtures'

test.describe('Authentification', () => {
  test('connexion réussie → accès au tableau de bord', async ({ page }) => {
    await login(page, E2E.users.porteur.email)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    // Un élément stable du tableau de bord (la barre de navigation авec le lien Analyses).
    await expect(page.getByRole('link', { name: /Analyses/i }).first()).toBeVisible()
  })

  test('mauvais mot de passe → accès refusé', async ({ page }) => {
    await login(page, E2E.users.porteur.email, 'MauvaisMotDePasse!1')
    await page.goto('/dashboard')
    // Non authentifié → redirection vers la page de connexion.
    await expect(page).toHaveURL(/\/auth\/signin/)
  })
})
