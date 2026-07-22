import type { Page } from '@playwright/test'
import { E2E } from './fixtures'

/**
 * Connexion via le flux credentials de next-auth (le POST callback pose le cookie
 * de session dans le contexte du navigateur → les navigations suivantes sont
 * authentifiées). Plus robuste que le remplissage du formulaire.
 */
export async function login(page: Page, email: string, password: string = E2E.password) {
  // Force la locale FR (cookie partagé server/client) — sinon Chromium hérite de
  // l'anglais et les libellés testés ne correspondent pas.
  await page.context().addCookies([{ name: 'acra-locale', value: 'fr', domain: 'localhost', path: '/' }])
  const csrf = await (await page.request.get('/api/auth/csrf')).json()
  await page.request.post('/api/auth/callback/credentials', {
    form: { csrfToken: csrf.csrfToken, email, password, json: 'true' },
  })
}
