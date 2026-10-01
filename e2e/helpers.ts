import type { BrowserContext, Page } from '@playwright/test'
import { E2E } from './fixtures'

type Cookies = Awaited<ReturnType<BrowserContext['cookies']>>

// Cookies de session déjà obtenus, par utilisateur (durée de vie : le processus de test).
// La connexion est limitée à 10 tentatives par e-mail et par 15 min (anti-force-brute,
// lib/auth.ts) ; la suite connectait le même utilisateur 10 fois : une seule relance
// d'un test suffisait à faire refuser la connexion suivante (CI du 2026-10-01).
// On réutilise donc la session d'un utilisateur au lieu de se reconnecter.
const sessions = new Map<string, Cookies>()

/**
 * Connexion via le flux credentials de next-auth (le POST callback pose le cookie
 * de session dans le contexte du navigateur → les navigations suivantes sont
 * authentifiées). Plus robuste que le remplissage du formulaire.
 * Une session valide déjà obtenue pour ce couple e-mail / mot de passe est réutilisée ;
 * une tentative en échec (mauvais mot de passe) n'est jamais mise en cache.
 * `fresh: true` force une vraie connexion (test du flux d'authentification lui-même).
 */
export async function login(page: Page, email: string, password: string = E2E.password, opts: { fresh?: boolean } = {}) {
  // Force la locale FR (cookie partagé server/client) — sinon Chromium hérite de
  // l'anglais et les libellés testés ne correspondent pas.
  const host = new URL(process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3101}`).hostname
  await page.context().addCookies([{ name: 'acra-locale', value: 'fr', domain: host, path: '/' }])

  const key = `${email}\u0000${password}`
  const cached = opts.fresh ? undefined : sessions.get(key)
  if (cached) {
    await page.context().addCookies(cached)
    if (await hasSession(page)) return
    sessions.delete(key)
  }

  const csrf = await (await page.request.get('/api/auth/csrf')).json()
  await page.request.post('/api/auth/callback/credentials', {
    form: { csrfToken: csrf.csrfToken, email, password, json: 'true' },
  })
  if (await hasSession(page)) {
    sessions.set(key, (await page.context().cookies()).filter(c => c.name !== 'acra-locale'))
  }
}

async function hasSession(page: Page): Promise<boolean> {
  const res = await page.request.get('/api/auth/session')
  const body = await res.json().catch(() => null) as { user?: unknown } | null
  return !!body?.user
}
