// Extraction des chaînes traduisibles de src/lib/ebios-data.ts vers un dictionnaire
// de clés i18n stables. Génère le squelette FR (rempli) + en/de/es/it (à traduire).
//
// Usage : node scripts/extract-ebios-data-i18n.mjs
//
// Stratégie : compile ebios-data via esbuild (transform fiable), require le module,
// parcourt chaque export et extrait les champs TEXTE (pas les enums/ids/couleurs).
// Clés stables : <EXPORT>.<id|index>[.<champ>] où id = ref/value/id si présent.

import { build } from 'esbuild'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'
const require = createRequire(import.meta.url)

// Champs dont la valeur STRING est un texte affiché → à traduire
const TEXT_FIELDS = new Set([
  'nom', 'description', 'label', 'titre', 'sousTitre', 'critere',
  'motivation', 'ressources', 'conseil', 'mesure', 'objectifVise',
])
// Champs dont la valeur est un TABLEAU de chaînes à traduire
const TEXT_ARRAY_FIELDS = new Set(['etapes'])
// Exports à ignorer (déjà traités ailleurs en i18n : ateliersMeta/etapes)
const SKIP_EXPORTS = new Set(['ATELIERS_META'])

// 1) Compile ebios-data → CJS temporaire
const tmp = path.join(root, '.pdf-runtime/_ebios-data.cjs')
await build({
  entryPoints: [path.join(root, 'src/lib/ebios-data.ts')],
  outfile: tmp, bundle: true, platform: 'node', format: 'cjs', target: 'node20',
  alias: { '@': path.join(root, 'src') }, logLevel: 'error',
})
const data = require(tmp)

const isStringArray = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string')
const stableId = (obj, i) => obj?.ref ?? obj?.value ?? obj?.id ?? String(i)

const fr = {}            // key -> texte FR
let count = 0
const add = (key, val) => { if (typeof val === 'string' && val.trim()) { fr[key] = val; count++ } }

function walkObject(obj, prefix) {
  for (const [field, v] of Object.entries(obj)) {
    if (typeof v === 'string' && TEXT_FIELDS.has(field)) add(`${prefix}.${field}`, v)
    else if (TEXT_ARRAY_FIELDS.has(field) && isStringArray(v)) v.forEach((s, j) => add(`${prefix}.${field}.${j}`, s))
  }
}

for (const [name, val] of Object.entries(data)) {
  if (typeof val === 'function' || SKIP_EXPORTS.has(name)) continue
  if (isStringArray(val)) { val.forEach((s, i) => add(`${name}.${i}`, s)); continue }
  if (Array.isArray(val)) {
    val.forEach((obj, i) => { if (obj && typeof obj === 'object') walkObject(obj, `${name}.${stableId(obj, i)}`) })
  } else if (val && typeof val === 'object') {
    for (const [k, obj] of Object.entries(val)) {
      if (obj && typeof obj === 'object') walkObject(obj, `${name}.${k}`)
    }
  }
}

// 2) Écrit les fichiers de traduction
const dir = path.join(root, 'src/lib/i18n/ebios-data')
fs.mkdirSync(dir, { recursive: true })
const keys = Object.keys(fr).sort()

const header = (lang) => `// ⚙️ AUTO-GÉNÉRÉ par scripts/extract-ebios-data-i18n.mjs\n` +
  `// Dictionnaire i18n des données EBIOS (exemples, référentiels, échelles).\n` +
  (lang === 'fr'
    ? `// Source FR — NE PAS éditer à la main (régénérer via le script).\n`
    : `// Traduction ${lang.toUpperCase()} — remplacer chaque valeur FR par la traduction.\n` +
      `// Une clé absente retombe automatiquement sur le FR.\n`)

// Mode --check : ne rien écrire, échouer si fr.ts (source auto-générée) a dérivé
// du catalogue (issue #116). À brancher en CI pour empêcher la dérive future.
const CHECK = process.argv.includes('--check')

function renderBody(lang, valueFor) {
  const lines = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(valueFor(k))},`)
  return `${header(lang)}\nconst dict: Record<string, string> = {\n${lines.join('\n')}\n}\nexport default dict\n`
}

function emit(lang, valueFor) {
  fs.writeFileSync(path.join(dir, `${lang}.ts`), renderBody(lang, valueFor))
}

if (CHECK) {
  const frPath = path.join(dir, 'fr.ts')
  const expected = renderBody('fr', (k) => fr[k])
  const actual = fs.existsSync(frPath) ? fs.readFileSync(frPath, 'utf-8') : ''
  fs.rmSync(tmp, { force: true })
  if (expected !== actual) {
    console.error('❌ src/lib/i18n/ebios-data/fr.ts est désynchronisé du catalogue ebios-data.ts (issue #116).')
    console.error('   Régénérez-le : node scripts/extract-ebios-data-i18n.mjs')
    process.exit(1)
  }
  console.log(`✅ fr.ts synchronisé avec le catalogue (${keys.length} clés).`)
  process.exit(0)
}

emit('fr', (k) => fr[k])
// en/de/es/it : on pré-remplit avec le FR comme point de départ (à traduire).
for (const lang of ['en', 'de', 'es', 'it']) {
  const existing = (() => { try { return fs.existsSync(path.join(dir, `${lang}.ts`)) } catch { return false } })()
  if (existing) { console.log(`[skip] ${lang}.ts existe déjà (conservé)`) ; continue }
  emit(lang, (k) => fr[k])
}

fs.rmSync(tmp, { force: true })
console.log(`\n✅ ${count} chaînes extraites → ${keys.length} clés`)
console.log(`   Fichiers : src/lib/i18n/ebios-data/{fr,en,de,es,it}.ts`)
// Aperçu de la répartition par export
const byExport = {}
for (const k of keys) { const e = k.split('.')[0]; byExport[e] = (byExport[e] || 0) + 1 }
console.log('\n   Répartition par bloc :')
for (const [e, n] of Object.entries(byExport).sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(4)}  ${e}`)
