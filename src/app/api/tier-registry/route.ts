import { NextRequest, NextResponse } from 'next/server'
import { partiesRattachables } from '@/lib/tier-registry.server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseWhereClause, isAdminRole, peutGererRegistreTic, type UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { classifyTierCoverage, cleanTierInput, findTierCandidates, normalizeLei, rootOrganizationIdOf, type TierLite } from '@/lib/tier-identity'

export const dynamic = 'force-dynamic'

async function context() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, scope }
}
const asAliases = (value: unknown): string[] => (Array.isArray(value) ? value.filter((a): a is string => typeof a === 'string') : [])

/**
 * Identités de tiers autorisées pour l'organisation active : couverture (cyber / TIC), arrangements TIC à rapprocher avec leurs
 * candidats. Aucun lien n'est décidé ici ; les analyses comptées sont celles auxquelles l'utilisateur a accès.
 */
export async function GET(_req: NextRequest) {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const orgId = ctx.scope.activeOrgId
  if (!orgId) return NextResponse.json({ active: false, tiers: [], unlinkedArrangements: [] })
  const cfg = await getOrgConfig(orgId)

  const granted = await prisma.tierOrganization.findMany({ where: { organizationId: orgId }, select: { tier: { select: { id: true, nom: true, lei: true, pays: true, aliases: true } } } })
  const tiers: (TierLite & { pays: string | null })[] = granted.map(g => ({ id: g.tier.id, nom: g.tier.nom, lei: g.tier.lei, pays: g.tier.pays, aliases: asAliases(g.tier.aliases) }))
  const arrangements = cfg.reglementaireActive
    ? await prisma.arrangementTic.findMany({ where: { organizationId: orgId }, select: { id: true, reference: true, prestataireNom: true, identifiant: true, tierId: true }, orderBy: { reference: 'asc' }, take: 1000 })
    : []
  const ids = tiers.map(t => t.id)
  const parties = ids.length
    ? await prisma.partiePrenante.findMany({ where: { tierId: { in: ids }, analyse: analyseWhereClause(ctx.userId, ctx.scope.role, ctx.scope.scope) }, select: { tierId: true, analyseId: true } })
    : []
  const analysesByTier = new Map<string, Set<string>>()
  for (const p of parties) if (p.tierId) analysesByTier.set(p.tierId, (analysesByTier.get(p.tierId) ?? new Set()).add(p.analyseId))

  const rows = tiers.map(t => {
    const own = arrangements.filter(a => a.tierId === t.id)
    const analysesCount = analysesByTier.get(t.id)?.size ?? 0
    return { id: t.id, nom: t.nom, lei: t.lei, pays: t.pays, aliases: t.aliases, analysesCount, arrangements: own.map(a => ({ id: a.id, reference: a.reference })), coverage: classifyTierCoverage({ cyber: analysesCount > 0, tic: own.length > 0 }) }
  })
  const nomOf = new Map(tiers.map(t => [t.id, t.nom]))
  const unlinkedArrangements = arrangements.filter(a => !a.tierId).map(a => ({
    id: a.id, reference: a.reference, prestataireNom: a.prestataireNom, lei: normalizeLei(a.identifiant),
    candidates: findTierCandidates({ nom: a.prestataireNom, lei: a.identifiant }, tiers).map(c => ({ ...c, nom: nomOf.get(c.tierId) ?? '' })),
  }))
  // Contrats groupe proposés à CETTE organisation : visibles pour décision (confirmer / refuser), sans aucun accès accordé d'avance.
  const pending = await prisma.tierContractBeneficiary.findMany({ where: { organizationId: orgId, status: 'PROPOSED' }, select: { arrangementId: true, arrangement: { select: { reference: true, prestataireNom: true, organization: { select: { nom: true } } } } } })
  const proposals = pending.map(p => ({ arrangementId: p.arrangementId, reference: p.arrangement.reference, prestataireNom: p.arrangement.prestataireNom, ownerNom: p.arrangement.organization.nom }))
  return NextResponse.json({ active: true, canManage: peutGererRegistreTic(ctx.scope.role), isAdmin: isAdminRole(ctx.scope.role), orgId, tiers: rows, unlinkedArrangements, proposals })
}

/** Crée une identité de tiers (ADMIN ou 2ᵉ ligne) : jamais de doublon silencieux, jamais de fuite d'un tiers d'une autre organisation. */
export async function POST(req: NextRequest) {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const orgId = ctx.scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 })
  if (!peutGererRegistreTic(ctx.scope.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const rl = await rateLimit(`tier-registry:${ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const body = await req.json().catch(() => ({}))
  const cleaned = cleanTierInput(body)
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 })
  const { nom, lei, pays, aliases } = cleaned.value
  const linkArrangementIds: string[] = Array.isArray(body.linkArrangementIds) ? body.linkArrangementIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, 50) : []
  // Services tiers (parties prenantes) à rattacher à la nouvelle entité : seulement ceux du périmètre, hors analyse gelée.
  const linkPartieIds: string[] = Array.isArray(body.linkPartieIds) ? body.linkPartieIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, 500) : []

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  const rootId = rootOrganizationIdOf(org?.path, orgId)
  const granted = await prisma.tierOrganization.findMany({ where: { organizationId: orgId }, select: { tier: { select: { id: true, nom: true, lei: true, pays: true, aliases: true } } } })
  const known: TierLite[] = granted.map(g => ({ id: g.tier.id, nom: g.tier.nom, lei: g.tier.lei, aliases: asAliases(g.tier.aliases) }))
  const grantedIds = known.map(t => t.id)

  // LEI déjà porté par un tiers du groupe auquel cette organisation n'a pas accès : on refuse sans rien révéler.
  if (lei) {
    const elsewhere = await prisma.tier.findFirst({ where: { rootOrganizationId: rootId, lei, id: { notIn: grantedIds } }, select: { id: true } })
    if (elsewhere) return NextResponse.json({ error: 'tier_exists_in_group' }, { status: 409 })
  }
  const candidates = findTierCandidates({ nom, lei }, known)
  if (candidates.length && body.confirmNew !== true) {
    return NextResponse.json({ error: 'possible_duplicate', candidates: candidates.map(c => ({ ...c, nom: known.find(t => t.id === c.tierId)?.nom ?? '' })) }, { status: 409 })
  }

  const partiesALier = linkPartieIds.length ? await partiesRattachables({ userId: ctx.userId, orgId, role: ctx.scope.role, canManage: true, isAdmin: isAdminRole(ctx.scope.role), scope: ctx.scope.scope }, linkPartieIds) : []
  const tier = await prisma.$transaction(async tx => {
    const created = await tx.tier.create({ data: { rootOrganizationId: rootId, nom, lei, pays, aliases } })
    await tx.tierOrganization.create({ data: { tierId: created.id, organizationId: orgId } })
    if (linkArrangementIds.length) await tx.arrangementTic.updateMany({ where: { id: { in: linkArrangementIds }, organizationId: orgId, tierId: null }, data: { tierId: created.id } })
    if (partiesALier.length) await tx.partiePrenante.updateMany({ where: { id: { in: partiesALier }, tierId: null }, data: { tierId: created.id } })
    return created
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.scope.role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'create', tierId: tier.id, nom, linked: linkArrangementIds.length, linkedParties: partiesALier.length } })
  return NextResponse.json({ id: tier.id, nom, lei, pays }, { status: 201 })
}
