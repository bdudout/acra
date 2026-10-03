// ─── Vérification des migrations (PUR) — lot 5 : CI (politique) et PRECHECK de la mise à jour (migrations en attente) ───
import { classifyMigration, validateNewMigration, type MigrationClass } from '@/lib/migration-policy'

export interface MigrationViolation { migration: string; code: 'destructive_without_header' | 'modified' | 'removed'; message: string }
export interface MigrationCheck { violations: MigrationViolation[]; pending: Array<{ migration: string; class: MigrationClass }>; destructive: string[] }

/**
 * `current` : migrations de la branche / de la cible ; `base` : migrations de la référence (origin/main) ou null ;
 * `applied` : noms déjà appliqués en base (PRECHECK) — absent : pas de calcul des migrations en attente.
 */
export function evaluateMigrations(current: Record<string, string>, base: Record<string, string> | null, applied?: readonly string[]): MigrationCheck {
  const violations: MigrationViolation[] = []
  if (base) {
    for (const [name, sql] of Object.entries(current)) {
      if (!(name in base)) {
        const v = validateNewMigration(sql)
        if (!v.ok) violations.push({ migration: name, code: 'destructive_without_header', message: v.reason ?? 'migration destructive sans en-tête' })
      } else if (base[name] !== sql) {
        violations.push({ migration: name, code: 'modified', message: 'une migration déjà publiée ne doit jamais être modifiée' })
      }
    }
    for (const name of Object.keys(base)) if (!(name in current)) violations.push({ migration: name, code: 'removed', message: 'une migration déjà publiée ne doit jamais être supprimée' })
  }
  const done = new Set(applied ?? [])
  const pending = applied ? Object.keys(current).sort().filter(n => !done.has(n)).map(n => ({ migration: n, class: classifyMigration(current[n]).class })) : []
  return { violations, pending, destructive: pending.filter(p => p.class === 'destructive').map(p => p.migration) }
}
