// ─── Garde unique des routes API : withAccess (T3 phase 2) ──────────────────
// Chaque route reconstruisait session → rôle → organisation → rôle effectif → rate limit
// → validation ; F01, F02, S1, S4, T1 et T25 venaient d'une variante recopiée incorrecte.
// `withAccess` impose cet ordre et ne laisse le handler s'exécuter qu'après tous les
// contrôles. Le rôle transmis est TOUJOURS le rôle effectif dans l'organisation ciblée
// (jamais le rôle global, sauf `org: 'none'`). Les prédicats viennent de `lib/permissions`.
//
//   export const PUT = withAccess(
//     { org: 'active', allow: isAdminRole, rateLimit: { bucket: 'relances' }, body: schema },
//     async (req, { user, role, orgId, body }) => { … },
//   )

import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import type { ZodType } from 'zod'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE, type RateLimitResult } from '@/lib/rate-limit'
import { sessionUser, type SessionUser } from '@/lib/route-guard.server'
import type { OrgScopeContext, UserRole } from '@/lib/permissions'

/**
 * Organisation dont le rôle effectif est résolu :
 * - `'active'` : organisation active (cookie) — 400 si aucune ;
 * - `{ param }` : organisation passée en paramètre de route — 403 sans rôle effectif ;
 * - `'none'` : action non rattachée à une organisation (rôle d'instance).
 */
export type OrgTarget = 'active' | 'none' | { param: string }

export interface AccessOptions<B> {
  org: OrgTarget
  /** Permission évaluée sur le rôle EFFECTIF (prédicat de `lib/permissions`). 403 si faux. */
  allow?: (role: UserRole) => boolean
  /** Seau de limitation par utilisateur (`<bucket>:<userId>`) ; défaut : LIMIT_API_WRITE. */
  rateLimit?: { bucket: string; limit?: number; windowMs?: number }
  /** Schéma du corps JSON ; champs inconnus retirés (`z.object`). 400 `invalid_body` sinon. */
  body?: ZodType<B>
}

export interface AccessContext<O extends OrgTarget, B> {
  user: SessionUser
  /** Rôle effectif dans `orgId` (rôle d'instance si `org: 'none'`). */
  role: UserRole
  orgId: O extends 'none' ? null : string
  /** Périmètre de visibilité (organisation active uniquement). */
  scope: O extends 'active' ? OrgScopeContext : null
  params: Record<string, string>
  body: B
  /** Résultat du rate limit (en-têtes `rateLimitHeaders` à renvoyer) ; null sans `rateLimit`. */
  rl: RateLimitResult | null
}

type RouteParams = { params: Promise<Record<string, string | string[] | undefined>> }

const fail = (status: number, error: string, extra?: Record<string, unknown>, headers?: Record<string, string>) =>
  NextResponse.json({ error, ...extra }, { status, headers })

export function withAccess<O extends OrgTarget, B = undefined>(
  opts: AccessOptions<B> & { org: O },
  handler: (req: NextRequest, ctx: AccessContext<O, B>) => Promise<Response>,
): (req: NextRequest, route: RouteParams) => Promise<Response> {
  return async (req, route) => {
    const user = sessionUser(await getServerSession(authOptions))
    if (!user) return fail(401, 'unauthorized')

    const raw = (await route?.params) ?? {}
    const params = Object.fromEntries(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string'))

    let role: UserRole
    let orgId: string | null = null
    let scope: OrgScopeContext | null = null
    if (opts.org === 'active') {
      const s = await getAnalyseScope(user.id, user.role)
      if (!s.activeOrgId) return fail(400, 'organization_required')
      role = s.role
      orgId = s.activeOrgId
      scope = s.scope
    } else if (opts.org === 'none') {
      role = user.role
    } else {
      const target = params[opts.org.param]
      const effective = target ? await getEffectiveRoleForOrg(user.id, user.role, target) : null
      if (!effective) return fail(403, 'forbidden')
      role = effective
      orgId = target
    }

    if (opts.allow && !opts.allow(role)) return fail(403, 'forbidden')

    let rl: RateLimitResult | null = null
    if (opts.rateLimit) {
      const { bucket, limit = LIMIT_API_WRITE.limit, windowMs = LIMIT_API_WRITE.windowMs } = opts.rateLimit
      rl = await rateLimit(`${bucket}:${user.id}`, limit, windowMs)
      if (!rl.allowed) return fail(429, 'rate_limited', undefined, rateLimitHeaders(rl.remaining, rl.resetAt))
    }

    let body = undefined as B
    if (opts.body) {
      let data: unknown
      try { data = await req.json() } catch { return fail(400, 'invalid_body') }
      const parsed = opts.body.safeParse(data)
      if (!parsed.success) return fail(400, 'invalid_body', { fields: [...new Set(parsed.error.issues.map(i => i.path.join('.')))] })
      body = parsed.data
    }

    return handler(req, { user, role, orgId, scope, params, body, rl } as AccessContext<O, B>)
  }
}
