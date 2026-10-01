/**
 * Cliquet du contrôle d'accès (audit 2026-09-30, T3) : les failles F01, F02, S1, S4 et T1
 * venaient de gardes recopiées route par route. Ce test échoue si une route API
 * redéfinit une garde locale, ou compare un rôle « SUPER_ADMIN » à la main hors des
 * exceptions métier listées : utiliser `lib/route-guard.server.ts` / `lib/permissions`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const API = join(process.cwd(), 'src/app/api')
function routes(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? routes(p) : name === 'route.ts' ? [p] : []
  })
}
const files = routes(API).map(p => ({ path: relative(process.cwd(), p), src: readFileSync(p, 'utf8') }))

// Usages métier (pas des gardes d'accès) : choix des rôles assignables, sélecteur d'organisation.
const ROLE_LITERAL_ALLOWED = new Set(['src/app/api/admin/users/route.ts', 'src/app/api/org/active/route.ts'])

describe('cliquet du contrôle d\'accès des routes API', () => {
  it('aucune route ne redéfinit une garde locale (requireAdmin, requireSuperAdmin…)', () => {
    const offenders = files.filter(f => /^(async )?function require(Admin|SuperAdmin)\b/m.test(f.src)).map(f => f.path)
    expect(offenders).toEqual([])
  })
  it('aucune comparaison de rôle SUPER_ADMIN ad hoc dans une route (hors usages métier listés)', () => {
    const offenders = files
      .filter(f => !ROLE_LITERAL_ALLOWED.has(f.path))
      .filter(f => /role\s*[!=]==\s*'SUPER_ADMIN'/.test(f.src))
      .map(f => f.path)
    expect(offenders).toEqual([])
  })
})
