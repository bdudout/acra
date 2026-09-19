import { test, expect } from '@playwright/test'
test('release publique : TLS, identité, connexion, analyse et PDF', async ({ page }) => {
  const { SMOKE_EMAIL, SMOKE_PASSWORD, EXPECT_VERSION, EXPECT_REVISION } = process.env
  if (!SMOKE_EMAIL || !SMOKE_PASSWORD || !EXPECT_VERSION || !EXPECT_REVISION) throw new Error('Configuration de recette publique manquante')
  const health = await page.request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(await health.json()).toMatchObject({ status: 'ok', db: 'connected', version: EXPECT_VERSION, revision: EXPECT_REVISION })
  expect(health.headers()['strict-transport-security']).toBeTruthy()
  expect(health.headers()['x-content-type-options']).toBe('nosniff')
  expect((await page.request.get('/api/analyses')).status()).toBe(401)
  const csrf = await (await page.request.get('/api/auth/csrf')).json()
  await page.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: SMOKE_EMAIL, password: SMOKE_PASSWORD, json: 'true' } })
  const response = await page.request.get('/api/analyses')
  expect(response.status()).toBe(200)
  const { analyses } = await response.json()
  expect(analyses.length).toBeGreaterThan(0)
  const id = analyses[0].id
  await page.goto(`/analyses/${id}/atelier/1`)
  await expect(page.locator('main')).toBeVisible()
  await expect(page).not.toHaveURL(/auth/)
  const pdf = await page.request.get(`/api/export/${id}?format=pdf`)
  expect(pdf.status()).toBe(200)
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')
})
