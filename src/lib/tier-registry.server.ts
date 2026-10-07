// ─── Contexte et garde d'accès communs aux routes /api/tier-registry ────────────────────────────────────────────────────────
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { analyseWhereClause, isAdminRole, peutGererRegistreTic, type OrgScopeContext, type UserRole } from '@/lib/permissions'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseGelee } from '@/lib/gel-analyse'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export interface TierCtx { userId: string; orgId: string; role: UserRole; canManage: boolean; isAdmin: boolean; scope: OrgScopeContext }

/** Session + organisation active + rôle effectif ; `write` ajoute le contrôle de droits (2ᵉ ligne ou ADMIN) et le débit. */
export async function tierContext(opts: { write?: 'manage' | 'admin' } = {}): Promise<{ ctx: TierCtx } | { error: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'organization_required' }, { status: 400 }) }
  const ctx: TierCtx = { userId, orgId: scope.activeOrgId, role: scope.role, canManage: peutGererRegistreTic(scope.role), isAdmin: isAdminRole(scope.role), scope: scope.scope }
  if (opts.write) {
    if (opts.write === 'admin' ? !ctx.isAdmin : !ctx.canManage) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
    const rl = await rateLimit(`tier-registry:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
    if (!rl.allowed) return { error: NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }) }
  }
  return { ctx }
}

/** Le tiers est-il autorisé pour l'organisation ? (jamais d'accès par simple appartenance au groupe) */
export async function tierGranted(tierId: string, orgId: string): Promise<boolean> {
  return !!(await prisma.tierOrganization.findUnique({ where: { tierId_organizationId: { tierId, organizationId: orgId } }, select: { tierId: true } }))
}

/**
 * Champ facultatif `tierId` d'une saisie d'arrangement : absent = lien inchangé ; nul ou vide = détachement ; valeur = rattachement
 * à condition que le tiers soit autorisé pour l'organisation (sinon `ok: false`).
 */
export async function resolveTierIdInput(body: Record<string, unknown>, orgId: string): Promise<{ ok: true; provided: false } | { ok: true; provided: true; tierId: string | null } | { ok: false }> {
  if (!('tierId' in body)) return { ok: true, provided: false }
  const raw = body.tierId
  if (raw === null || raw === '' || raw === undefined) return { ok: true, provided: true, tierId: null }
  if (typeof raw !== 'string' || !(await tierGranted(raw, orgId))) return { ok: false }
  return { ok: true, provided: true, tierId: raw }
}

/**
 * Liens partie prenante → identité de tiers d'une sauvegarde d'atelier : ne garde que les tiers AUTORISÉS pour l'organisation de
 * l'analyse, détache les autres (comptés) — une sauvegarde automatique ne doit jamais échouer pour un accès retiré entre-temps.
 */
export async function sanitizeTierLinks<T extends { tierId?: string | null }>(rows: T[], orgId: string | null): Promise<{ rows: T[]; dropped: number }> {
  const wanted = [...new Set(rows.flatMap(r => (r.tierId ? [r.tierId] : [])))]
  if (!wanted.length) return { rows, dropped: 0 }
  const granted = new Set(orgId ? (await prisma.tierOrganization.findMany({ where: { organizationId: orgId, tierId: { in: wanted } }, select: { tierId: true } })).map(g => g.tierId) : [])
  let dropped = 0
  const out = rows.map(r => { if (r.tierId && !granted.has(r.tierId)) { dropped += 1; return { ...r, tierId: null } } return r })
  return { rows: out, dropped }
}

/** Filtre d'accès aux parties prenantes (services tiers) de l'organisation active, dans les analyses visibles et non supprimées. */
export function partiesDeLOrganisation(ctx: TierCtx) {
  return { analyse: { AND: [analyseWhereClause(ctx.userId, ctx.role, ctx.scope), { organizationId: ctx.orgId }] } }
}

/**
 * Parties prenantes qu'on peut rattacher à une entité (ou détacher) : de l'organisation active, visibles, dans une analyse non
 * gelée (acceptation des résiduels). Les autres identifiants sont ignorés — jamais d'écriture hors périmètre.
 */
export async function partiesRattachables(ctx: TierCtx, ids: readonly string[]): Promise<string[]> {
  if (!ids.length) return []
  const [rows, cfg] = await Promise.all([
    prisma.partiePrenante.findMany({ where: { id: { in: [...ids] }, ...partiesDeLOrganisation(ctx) }, select: { id: true, analyse: { select: { risquesResiduelsStatut: true } } } }),
    getOrgConfig(ctx.orgId),
  ])
  return rows.filter(r => !analyseGelee(r.analyse.risquesResiduelsStatut, cfg.gelApresAcceptationActive)).map(r => r.id)
}
