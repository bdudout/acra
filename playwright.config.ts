import { defineConfig, devices } from '@playwright/test'

/**
 * Tests end-to-end (parcours réels dans le navigateur). Complètent les 768 tests
 * unitaires Vitest en vérifiant les chemins critiques bout-en-bout.
 *
 * Prérequis d'exécution :
 *  - une base PostgreSQL accessible (par défaut la base Docker exposée sur
 *    localhost:5432) via `DATABASE_URL` ;
 *  - le `globalSetup` amorce un jeu de données déterministe (préfixe `e2e_`).
 *
 * Local : `npm run test:e2e` (démarre un serveur `next dev` sur le port 3101,
 * ou réutilise un serveur déjà lancé sur ce port).
 */
const PORT = Number(process.env.E2E_PORT ?? 3101)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: { PORT: String(PORT), NEXTAUTH_URL: BASE_URL },
      },
})
