// ─── Écart de migrations (PUR) — docs/specs/sauvegarde-rollback-spec.md, lot 4 ───
// Compare les migrations livrées dans l'image (dossiers de `prisma/migrations`) à `_prisma_migrations` :
// la santé approfondie (`/api/health?deep=1`) est « dégradée » si l'une est en attente ou en échec.

export interface MigrationRow { migration_name: string; finished_at: string | Date | null; rolled_back_at: string | Date | null }
export interface MigrationDrift { expected: number; applied: number; pending: string[]; failed: string[]; unknownInImage?: string[] }

export function migrationDrift(expected: readonly string[], rows: readonly MigrationRow[]): MigrationDrift {
  const exp = [...new Set(expected)].sort()
  const applied = new Set<string>()
  const started = new Set<string>()
  for (const r of rows) {
    if (r.rolled_back_at) continue
    if (r.finished_at) applied.add(r.migration_name)
    else started.add(r.migration_name)
  }
  const failed = exp.filter(n => started.has(n) && !applied.has(n))
  const pending = exp.filter(n => !applied.has(n) && !started.has(n))
  const unknown = [...applied].filter(n => !exp.includes(n)).sort()
  return { expected: exp.length, applied: exp.filter(n => applied.has(n)).length, pending, failed, ...(unknown.length ? { unknownInImage: unknown } : {}) }
}
