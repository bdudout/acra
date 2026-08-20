// audit-check.mjs — barrière d'audit npm avec allowlist SCOPÉE et documentée.
//
// Remplace `npm audit --omit=dev --audit-level=moderate` : bloque toujours sur
// toute advisory moderate+ des dépendances de PRODUCTION, SAUF celles listées
// explicitement (par GHSA) dans `.audit-allowlist.json` avec justification.
//
// Objectif : garder l'arbre de prod à zéro advisory non justifiée, tout en
// autorisant une exception ciblée (ici image-size, DoS non atteignable, tiré par
// pptxgenjs pour l'export PPTX). Toute NOUVELLE advisory non listée fait échouer.

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const SEVERITIES = ['moderate', 'high', 'critical'] // seuil = moderate (comme avant)
const root = new URL('..', import.meta.url).pathname

// 1) Charger l'allowlist.
const allowPath = root + '.audit-allowlist.json'
let allow = []
if (existsSync(allowPath)) {
  const cfg = JSON.parse(readFileSync(allowPath, 'utf8'))
  allow = Array.isArray(cfg.allow) ? cfg.allow : []
}
const allowByGhsa = new Map(allow.map(a => [a.ghsa, a]))

// 2) Lancer npm audit en JSON (n'échoue pas le process ici : on interprète nous-mêmes).
let raw = ''
try {
  raw = execSync('npm audit --omit=dev --json', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
} catch (e) {
  // npm audit sort en code non nul dès qu'il trouve des vulnérabilités : on récupère
  // malgré tout sa sortie JSON sur stdout.
  raw = e.stdout ? e.stdout.toString() : ''
}
if (!raw.trim()) { console.error('audit-check: sortie npm audit vide'); process.exit(2) }

let report
try { report = JSON.parse(raw) } catch { console.error('audit-check: JSON npm audit illisible'); process.exit(2) }

// 3) Extraire les advisories (format npm v7+ : vulnerabilities[pkg].via[]).
//    Une entrée `via` objet = advisory réelle (avec url GHSA + severity).
const ghsaOf = (url) => (typeof url === 'string' && url.match(/GHSA-[0-9a-z-]+/i)?.[0]) || null
const found = new Map() // ghsa -> { ghsa, package, severity, title, url }
for (const [, node] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of node.via ?? []) {
    if (typeof via !== 'object') continue
    if (!SEVERITIES.includes(via.severity)) continue
    const ghsa = ghsaOf(via.url)
    if (!ghsa) continue
    found.set(ghsa, { ghsa, package: via.name ?? node.name, severity: via.severity, title: via.title, url: via.url })
  }
}

// 4) Séparer suspendu vs bloquant.
const suppressed = []
const blocking = []
for (const adv of found.values()) {
  const a = allowByGhsa.get(adv.ghsa)
  if (a && (!a.package || a.package === adv.package)) suppressed.push({ ...adv, allow: a })
  else blocking.push(adv)
}

// 5) Rapport.
if (suppressed.length) {
  console.log('Advisories suspendues (allowlist documentée) :')
  for (const s of suppressed) {
    const expired = s.allow.review && new Date(s.allow.review) < new Date()
    console.log(`  · ${s.ghsa} [${s.severity}] ${s.package} — ${s.url}`)
    console.log(`    justification : ${s.allow.reason ?? '—'}`)
    if (s.allow.review) console.log(`    revue prévue  : ${s.allow.review}${expired ? '  ⚠ ÉCHUE' : ''}`)
    if (expired) console.log(`::warning::Exception d'audit ${s.ghsa} échue (revue ${s.allow.review}) — vérifier si un correctif ${s.package} existe.`)
  }
}
// Signaler une allowlist morte (GHSA plus présente) pour éviter des exceptions fantômes.
for (const a of allow) {
  if (!found.has(a.ghsa)) console.log(`::warning::Entrée d'allowlist inutile : ${a.ghsa} (${a.package}) n'apparaît plus dans l'audit — la retirer de .audit-allowlist.json.`)
}

if (blocking.length) {
  console.error(`\n✗ ${blocking.length} advisory(ies) moderate+ NON autorisée(s) dans les dépendances de production :`)
  for (const b of blocking) console.error(`  · ${b.ghsa} [${b.severity}] ${b.package} — ${b.title} (${b.url})`)
  console.error('\nTraiter la vulnérabilité (mise à jour / override) ou, si justifié, l\'ajouter à .audit-allowlist.json.')
  process.exit(1)
}

console.log(`\n✓ Audit de production propre (${suppressed.length} exception(s) documentée(s), 0 advisory bloquante).`)
process.exit(0)
