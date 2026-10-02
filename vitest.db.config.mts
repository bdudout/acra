// Tests d'intégration sur une VRAIE base PostgreSQL (audit 2026-09-30, T7).
// Les tests unitaires mockent Prisma : ils ne voient ni une contrainte FK, ni un
// verrou absent, ni une dérive de migration. Ceux-ci appellent les vraies routes
// avec le vrai client Prisma (seule la session est simulée).
// Prérequis : DATABASE_URL vers une base migrée (`prisma migrate deploy`).
// Lancement : npm run test:db (job CI « db-integration »).
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Vitest 5 vide les mocks avant chaque test par défaut : on garde le comportement de Vitest 4
    // (des appels enregistrés dans un beforeAll restent visibles dans les tests).
    clearMocks: false,
    include: ['src/__tests__/db/**/*.db.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: fileURLToPath(new URL('./src/$1', import.meta.url)) },
    ],
  },
})
