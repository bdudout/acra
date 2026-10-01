import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Vitest 5 vide les mocks avant chaque test par défaut : on garde le comportement de Vitest 4
    // (des appels enregistrés dans un beforeAll restent visibles dans les tests).
    clearMocks: false,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Tests d'intégration sur vraie base : config dédiée (vitest.db.config.mts, job CI db-integration).
    exclude: [...configDefaults.exclude, 'src/__tests__/db/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/__tests__/setup.ts'],
    },
  },
  resolve: {
    // Forme tableau/regex : plus fiable que l'alias-chaîne sous vitest 4 / Node 26
    // (l'alias-chaîne retombait sur le résolveur natif Node → « Cannot find package '@/…' »).
    alias: [
      { find: /^@\/(.*)$/, replacement: fileURLToPath(new URL('./src/$1', import.meta.url)) },
    ],
  },
})
