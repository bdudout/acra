// Configuration ESLint (flat config, Next 16) — audit 2026-09-30, T4.
// Démarrage en AVERTISSEMENTS sur les règles qui signalent de la dette existante
// (any, dépendances de hooks) : la CI échoue seulement sur les ERREURS. Passer
// une règle en « error » module par module une fois sa dette résorbée.
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
      // Règles du compilateur React (eslint-plugin-react-hooks 6) et de style JSX : dette
      // existante sans défaut d'exécution constaté (revue du 2026-10-01) → avertissements.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
  globalIgnores([
    '.next/**', 'out/**', 'build/**', 'next-env.d.ts',
    '.pdf-runtime/**', 'coverage/**', 'playwright-report/**', 'test-results/**',
    'public/**', 'rapports/**', 'docs/**', '.agents/**', '.acra-test-memory/**',
  ]),
])
