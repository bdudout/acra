import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { E2E } from './fixtures'

test.describe('Projets 360', () => {
  test('lancer un projet 360 puis en partir pour une analyse cyber', async ({ page }) => {
    await login(page, E2E.users.porteur.email)
    await page.goto('/projets')
    await page.getByRole('button', { name: 'Lancer un projet 360' }).click()
    await page.getByLabel('Nom du projet').fill('e2e_Projet portail')
    await page.getByLabel('Description / périmètre').fill('Portail client — périmètre e2e')
    const sector = page.getByRole('combobox', { name: /secteur/i })
    await sector.selectOption({ index: 1 })
    const chosenSector = await sector.inputValue()
    await page.getByRole('checkbox', { name: /SI standard/ }).check()
    await page.getByRole('button', { name: 'Créer le projet' }).click()
    // Le questionnaire de qualification s'ouvre directement.
    await expect(page).toHaveURL(/\/atelier\/1\?phase=qualification/)

    // Depuis l'onglet Projets : « Lancer une analyse cyber » ouvre la création préremplie.
    await page.goto('/projets')
    const ligne = page.getByRole('row', { name: /e2e_Projet portail/ })
    await ligne.getByRole('link', { name: 'Lancer une analyse cyber' }).click()
    await expect(page).toHaveURL(/\/analyses\/new\?projet=/)
    await expect(page.locator('#projet-source')).not.toHaveValue('')
    await expect(page.locator('#analyse-nom')).toHaveValue('Analyse cyber — e2e_Projet portail')
    await expect(page.getByRole('combobox', { name: /secteur/i })).toHaveValue(chosenSector)
    await expect(page.getByRole('checkbox', { name: /SI standard/ })).toBeChecked()
  })
})
