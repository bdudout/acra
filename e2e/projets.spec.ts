import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { E2E } from './fixtures'

test.describe('Projets 360', () => {
  test('lancer un projet 360 puis en partir pour une analyse cyber', async ({ page }) => {
    await login(page, E2E.users.porteur.email)
    await page.goto('/projets')
    // Lancement dans une page dédiée (/projets/nouveau).
    await page.getByRole('link', { name: 'Lancer un projet 360' }).click()
    await expect(page).toHaveURL(/\/projets\/nouveau/)
    await page.getByLabel('Nom du projet').fill('e2e_Projet portail')
    await page.getByLabel('Description / périmètre').fill('Portail client — périmètre e2e')
    const sector = page.locator('#projet-secteur')
    await sector.selectOption({ index: 1 })
    const chosenSector = await sector.inputValue()
    await page.locator('input[data-pattern-code="SI_STANDARD"]').check()
    await page.getByRole('button', { name: 'Créer le projet' }).click()
    // Le questionnaire de qualification s'ouvre directement.
    await expect(page).toHaveURL(/\/atelier\/1\?phase=qualification/)

    // Depuis la liste des projets : « Associer une analyse cyber › Créer une nouvelle analyse » ouvre la création préremplie.
    await page.goto('/projets')
    const ligne = page.getByRole('row', { name: /e2e_Projet portail/ })
    await ligne.getByText('Associer une analyse cyber').click()
    await ligne.getByRole('link', { name: 'Créer une nouvelle analyse' }).click()
    await expect(page).toHaveURL(/\/analyses\/new\?projet=/)
    await expect(page.locator('#projet-source')).not.toHaveValue('')
    await expect(page.locator('#analyse-nom')).toHaveValue('Analyse cyber — e2e_Projet portail')
    await expect(page.locator('#analyse-secteur')).toHaveValue(chosenSector)
    await expect(page.locator('input[data-pattern-code="SI_STANDARD"]')).toBeChecked()
  })
})
