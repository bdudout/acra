// Vérification des migrations Prisma (lot 5 de docs/specs/sauvegarde-rollback-spec.md).
//   npx tsx scripts/check-migrations.ts --ci [--base origin/main]        CI : politique (nouvelle migration destructive sans en-tête, migration publiée modifiée)
//   npx tsx scripts/check-migrations.ts --json --ref <sha> --applied-file F   PRECHECK de la mise à jour : migrations en attente et leur classe
// Les migrations de `--ref` sont lues dans les objets git (la cible n'est pas encore extraite) ; sans `--ref`, dans le dossier de travail.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { evaluateMigrations } from '../src/lib/migration-check'

const argv = process.argv.slice(2)
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined }
const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

function fromDisk(): Record<string, string> {
  const dir = path.join(process.cwd(), 'prisma', 'migrations'); const out: Record<string, string> = {}
  for (const n of readdirSync(dir)) {
    const f = path.join(dir, n, 'migration.sql')
    if (/^\d{14}_/.test(n) && statSync(path.join(dir, n)).isDirectory() && existsSync(f)) out[n] = readFileSync(f, 'utf8')
  }
  return out
}
function fromRef(ref: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of git('ls-tree', '--name-only', `${ref}:prisma/migrations/`).split('\n').filter(x => /^\d{14}_/.test(x))) {
    try { out[n] = git('show', `${ref}:prisma/migrations/${n}/migration.sql`) } catch { /* dossier sans migration.sql */ }
  }
  return out
}

const ref = opt('--ref')
const current = ref ? fromRef(ref) : fromDisk()
const applied = opt('--applied-file') ? readFileSync(opt('--applied-file')!, 'utf8').split('\n').map(s => s.trim()).filter(Boolean) : undefined
const base = argv.includes('--ci') ? fromRef(opt('--base') ?? 'origin/main') : null
const result = evaluateMigrations(current, base, applied)

if (argv.includes('--json')) { console.log(JSON.stringify(result)); process.exit(0) }
for (const v of result.violations) console.error(`✗ ${v.migration} : ${v.message}`)
if (result.violations.length) process.exit(1)
console.log(`✓ migrations conformes (${Object.keys(current).length} dossiers)`)
