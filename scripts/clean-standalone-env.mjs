// Purge tout fichier .env de la sortie de build `.next/standalone` (audit R06 /
// CWE-200,538). Défense en profondeur : `.dockerignore` exclut déjà `.env`/`.next`
// de l'image, mais un déploiement MANUEL du dossier standalone (rsync/scp) ne doit
// jamais embarquer de secrets. Les secrets sont injectés au runtime (env du conteneur).
// No-op si le dossier ou les fichiers sont absents.
import { readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), '.next', 'standalone')
let removed = 0

function walk(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      if (entry === 'node_modules') continue // pas de .env applicatif ici
      walk(full)
    } else if (entry === '.env' || entry.startsWith('.env.')) {
      try { rmSync(full); removed++; console.log('[clean-standalone-env] supprimé :', path.relative(process.cwd(), full)) } catch {}
    }
  }
}

walk(root)
console.log(`[clean-standalone-env] ${removed} fichier(s) .env purgé(s) de .next/standalone`)
