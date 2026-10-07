// ─── Services tiers de l'organisation et leur entité de tiers ─────────────────
// GET  — parties prenantes des analyses visibles de l'organisation active, regroupées par nom (lib/services-tiers) avec les
//        entités rattachées et les candidates (proposées, jamais appliquées).
// POST — { partieIds: string[], tierId: string | null } : rattache (ou détache) ces occurrences à une entité autorisée pour
//        l'organisation (ADMIN ou 2ᵉ ligne). Hors périmètre ou analyse gelée : ignoré. Scores de l'analyse inchangés.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { partiesDeLOrganisation, partiesRattachables, tierContext, tierGranted } from '@/lib/tier-registry.server'
import { regrouperServicesTiers } from '@/lib/services-tiers'

export const dynamic = 'force-dynamic'
const MAX_IDS = 500
const asAliases = (value: unknown): string[] => (Array.isArray(value) ? value.filter((a): a is string => typeof a === 'string') : [])

export async function GET() {
  const got = await tierContext(); if ('error' in got) return got.error
  const { ctx } = got
  const [parties, granted] = await Promise.all([
    prisma.partiePrenante.findMany({
      where: partiesDeLOrganisation(ctx),
      select: { id: true, nom: true, type: true, tierId: true, analyseId: true, analyse: { select: { nom: true } } },
      take: 5000,
    }),
    prisma.tierOrganization.findMany({ where: { organizationId: ctx.orgId }, select: { tier: { select: { id: true, nom: true, lei: true, aliases: true } } } }),
  ])
  const tiers = granted.map(g => ({ id: g.tier.id, nom: g.tier.nom, lei: g.tier.lei, aliases: asAliases(g.tier.aliases) }))
  const services = regrouperServicesTiers(parties.map(p => ({ id: p.id, nom: p.nom, type: p.type, tierId: p.tierId, analyseId: p.analyseId, analyseNom: p.analyse.nom })), tiers)
  return NextResponse.json({ canManage: ctx.canManage, services })
}

export async function POST(req: NextRequest) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.partieIds) ? body.partieIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, MAX_IDS) : []
  const tierId = typeof body.tierId === 'string' && body.tierId ? body.tierId : null
  if (!ids.length) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  if (tierId && !(await tierGranted(tierId, ctx.orgId))) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const autorises = await partiesRattachables(ctx, ids)
  const { count } = autorises.length ? await prisma.partiePrenante.updateMany({ where: { id: { in: autorises } }, data: { tierId } }) : { count: 0 }
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: tierId ? 'link-parties' : 'unlink-parties', tierId, count, ignored: ids.length - count } })
  return NextResponse.json({ ok: true, linked: count, ignored: ids.length - count })
}
