/**
 * Cliquet du contrôle d'accès (audit 2026-09-30, T3) : les failles F01, F02, S1, S4 et T1
 * venaient de gardes recopiées route par route. Ce test échoue si une route API
 * redéfinit une garde locale, ou compare un rôle « SUPER_ADMIN » à la main hors des
 * exceptions métier listées : utiliser `lib/route-guard.server.ts` / `lib/permissions`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { LEGACY_SESSION_WRITE_ROUTES } from './legacy-session-write-routes'

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

  // T3 phase 2 : les routes d'écriture passent par `withAccess` (rôle effectif de l'org cible,
  // permission, rate limit, schéma du corps), jamais par une lecture locale de la session.
  const isWrite = (src: string) => /export\s+(async\s+function|const)\s+(POST|PUT|PATCH|DELETE)\b/.test(src)
  const readsSession = (src: string) => /\bgetServerSession\b/.test(src)
  it('aucune NOUVELLE route d\'écriture ne lit la session elle-même (utiliser withAccess)', () => {
    const legacy = new Set(LEGACY_SESSION_WRITE_ROUTES)
    const offenders = files.filter(f => isWrite(f.src) && readsSession(f.src) && !legacy.has(f.path)).map(f => f.path)
    expect(offenders).toEqual([])
  })
  it('la liste des routes héritées ne contient que des routes encore à migrer (retirer les routes migrées)', () => {
    const still = new Set(files.filter(f => isWrite(f.src) && readsSession(f.src)).map(f => f.path))
    expect(LEGACY_SESSION_WRITE_ROUTES.filter(p => !still.has(p))).toEqual([])
  })
})
