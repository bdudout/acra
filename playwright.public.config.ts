import { defineConfig, devices } from '@playwright/test'
// Aucun seed, aucune connexion DB, aucune suppression sur l'instance publique.
export default defineConfig({
  testDir: './e2e-public', timeout: 60000, workers: 1, retries: 0,
  use: { baseURL: 'https://acra-cyber.com', trace: 'off', screenshot: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
