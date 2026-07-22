import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { E2E } from './fixtures'

test.describe('Dérogations', () => {
  test('déroger un contrôle non-conforme depuis le socle (Atelier 1)', async ({ page }) => {
    await login(page, E2E.users.porteur.email)
    await page.goto(`/analyses/${E2E.analyseId}/atelier/1`)

    // Aller sur l'onglet « Socle de sécurité » où se trouve la grille de conformité.
    await page.getByRole('button', { name: /Socle de sécurité/ }).click()

    // Un seul contrôle non-conforme (5.1) → un seul bouton « Déroger »
    // (apparaît après le chargement de l'état des dérogations par la grille).
    const deroger = page.getByRole('button', { name: /Déroger/ })
    await expect(deroger).toBeVisible()
    await deroger.click()

    // Formulaire minimal : motif + mesures compensatoires.
    const zones = page.locator('textarea')
    await zones.nth(0).fill('Politique SSI en cours de rédaction, publication T4')
    await zones.nth(1).fill('Notes de cadrage + revue trimestrielle du RSSI')
    await page.getByRole('button', { name: /Envoyer la demande/ }).click()

    // La demande passe « En revue » (workflow RSSI, statut DEMANDEE).
    await expect(page.getByText('En revue').first()).toBeVisible()

    // Elle apparaît dans le registre sous le filtre « En revue » (le filtre par
    // défaut « En cours et expirées » ne montre que les dérogations actives).
    await page.goto('/derogations')
    await page.getByRole('button', { name: /En revue/ }).click()
    await expect(page.getByText(/5\.1/).first()).toBeVisible()
  })
})
