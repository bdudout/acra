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

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { ZodType } from 'zod'
import { authOptions } from '@/lib/auth'
import { analyseAccessWhere, getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseGelee, STATUT_GEL } from '@/lib/gel-analyse'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE, type RateLimitResult } from '@/lib/rate-limit'
import { sessionUser, type SessionUser } from '@/lib/route-guard.server'
import { canEditAnalyse, resolveAnalyseRole, type OrgScopeContext, type UserRole } from '@/lib/permissions'

/**
 * Organisation dont le rôle effectif est résolu :
 * - `'active'` : organisation active (cookie) — 400 si aucune ;
 * - `{ param }` : organisation passée en paramètre de route — 403 sans rôle effectif ;
 * - `{ analyse }` : analyse passée en paramètre de route, chargée DANS le périmètre (`analyseAccessWhere`,
 *   404 sinon ou si elle est en corbeille) ; rôle effectif dans l'organisation DE L'ANALYSE
 *   (`resolveAnalyseRole` : LECTEUR si l'accès vient d'un partage sans appartenance). `write: true` exige en
 *   plus le droit d'éditer (`canEditAnalyse`, 403) et une analyse non gelée (403 `ANALYSE_GELEE`) ;
 * - `'none'` : action non rattachée à une organisation (rôle d'instance).
 */
export type OrgTarget = 'active' | 'none' | { param: string } | { analyse: string; write?: boolean }

/** Analyse ciblée, chargée dans le périmètre de l'utilisateur. */
export interface AnalyseAccess {
  id: string
  organizationId: string
  /** Propriétaire. */
  userId: string
  statut: string
  methode: string
  risquesResiduelsStatut: string | null
  accesUtilisateurs: { userId: string; permission: string }[]
}

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
  /** Analyse ciblée (`org: { analyse }` uniquement). */
  analyse: O extends { analyse: string } ? AnalyseAccess : null
  params: Record<string, string>
  body: B
  /** Résultat du rate limit (en-têtes `rateLimitHeaders` à renvoyer) ; null sans `rateLimit`. */
  rl: RateLimitResult | null
}

type RouteParams = { params: Promise<Record<string, string | string[] | undefined>> }

/**
 * Handler de route. Surcharges : Next contrôle la DERNIÈRE signature (requête + contexte de route) ;
 * les précédentes permettent d'appeler `GET()` ou `POST(req)` sans contexte (tests, appels internes).
 */
export interface RouteHandler {
  (): Promise<Response>
  (req: NextRequest): Promise<Response>
  (req: NextRequest, route: RouteParams): Promise<Response>
}

const fail = (status: number, error: string, extra?: Record<string, unknown>, headers?: Record<string, string>) =>
  NextResponse.json({ error, ...extra }, { status, headers })

export function withAccess<O extends OrgTarget, B = undefined>(
  opts: AccessOptions<B> & { org: O },
  handler: (req: NextRequest, ctx: AccessContext<O, B>) => Promise<Response>,
): RouteHandler {
  const run = async (reqArg?: NextRequest, route?: RouteParams): Promise<Response> => {
    const req = reqArg ?? new NextRequest('http://localhost/')
    const user = sessionUser(await getServerSession(authOptions))
    if (!user) return fail(401, 'unauthorized')

    const raw = (await route?.params) ?? {}
    const params = Object.fromEntries(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string'))

    const target: OrgTarget = opts.org
    let role: UserRole
    let orgId: string | null = null
    let scope: OrgScopeContext | null = null
    let analyse: AnalyseAccess | null = null
    if (target === 'active') {
      const s = await getAnalyseScope(user.id, user.role)
      if (!s.activeOrgId) return fail(400, 'organization_required')
      role = s.role
      orgId = s.activeOrgId
      scope = s.scope
    } else if (target === 'none') {
      role = user.role
    } else if ('analyse' in target) {
      const id = params[target.analyse]
      const row = id
        ? await prisma.analyse.findFirst({
            where: await analyseAccessWhere(user.id, user.role, id),
            select: { id: true, organizationId: true, userId: true, statut: true, methode: true, risquesResiduelsStatut: true, deletedAt: true, accesUtilisateurs: { select: { userId: true, permission: true } } },
          })
        : null
      if (!row || row.deletedAt) return fail(404, 'not_found')
      const { deletedAt: _deleted, ...a } = row
      analyse = a
      orgId = a.organizationId
      role = resolveAnalyseRole(user.role, a.organizationId, await getEffectiveRoleForOrg(user.id, user.role, a.organizationId))
      if (target.write) {
        if (!canEditAnalyse({ id: user.id, role }, { userId: a.userId, accesUtilisateurs: a.accesUtilisateurs })) return fail(403, 'forbidden')
        // Gel après acceptation des risques résiduels : même règle que la saisie directe (guardDirectRisk).
        if (a.risquesResiduelsStatut === STATUT_GEL && analyseGelee(a.risquesResiduelsStatut, (await getOrgConfig(a.organizationId)).gelApresAcceptationActive)) {
          return fail(403, 'ANALYSE_GELEE')
        }
      }
    } else {
      const cible = params[target.param]
      const effective = cible ? await getEffectiveRoleForOrg(user.id, user.role, cible) : null
      if (!effective) return fail(403, 'forbidden')
      role = effective
      orgId = cible
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

    return handler(req, { user, role, orgId, scope, analyse, params, body, rl } as AccessContext<O, B>)
  }
  return run as RouteHandler
}
