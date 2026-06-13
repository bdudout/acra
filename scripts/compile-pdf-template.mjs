// Compile le template PDF (TSX) en CJS autonome via esbuild — le MÊME transform
// que celui utilisé par les tests (qui fonctionne), à l'inverse de SWC/Next qui
// produit un arbre rejeté par @react-pdf/renderer (« React error #31 »).
// Le bundle est chargé au RUNTIME par la route d'export (require dynamique), donc
// Next ne le re-transforme pas.
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'

await build({
  entryPoints: [path.join(root, 'src/lib/pdf-template.tsx')],
  outfile: path.join(root, '.pdf-runtime/pdf-template.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  jsx: 'automatic',
  // react-pdf et react restent externes → résolus depuis node_modules au runtime
  // (instance unique), comme dans les tests.
  external: ['@react-pdf/renderer', 'react', 'react-dom'],
  // Résout l'alias @/ comme tsconfig
  alias: { '@': path.join(root, 'src') },
  logLevel: 'info',
})
console.log('[compile-pdf-template] .pdf-runtime/pdf-template.cjs généré')
