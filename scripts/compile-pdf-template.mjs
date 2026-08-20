// Compile le template PDF (TSX) en CJS autonome via esbuild — le MÊME transform
// que celui utilisé par les tests (qui fonctionne), à l'inverse de SWC/Next qui
// produit un arbre rejeté par @react-pdf/renderer (« React error #31 »).
// Le bundle est chargé au RUNTIME par la route d'export (require dynamique), donc
// Next ne le re-transforme pas.
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'

// Chaque template PDF est compilé en bundle CJS autonome (même transform).
const TEMPLATES = [
  { entry: 'src/lib/pdf-template.tsx', out: '.pdf-runtime/pdf-template.cjs' },
  { entry: 'src/lib/carto-pdf-template.tsx', out: '.pdf-runtime/carto-pdf-template.cjs' },
  { entry: 'src/lib/ras-pdf-template.tsx', out: '.pdf-runtime/ras-pdf-template.cjs' },
  { entry: 'src/lib/soa-pdf-template.tsx', out: '.pdf-runtime/soa-pdf-template.cjs' },
]

for (const { entry, out } of TEMPLATES) {
  await build({
    entryPoints: [path.join(root, entry)],
    outfile: path.join(root, out),
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
  console.log(`[compile-pdf-template] ${out} généré`)
}
