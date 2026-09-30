import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { tierContext, tierGranted } from '@/lib/tier-registry.server'
import { isGroupAdminMerge, mergeAliases, planTierMerge, type MergeError } from '@/lib/tier-merge'
import { normalizeLei } from '@/lib/tier-identity'

export const dynamic = 'force-dynamic'

type Db = Pick<typeof prisma, 'tierOrganization' | 'arrangementTic' | 'partiePrenante' | 'tierService' | 'tierServiceUsage' | 'tier'>

/** Ce que la fusion déplacerait, et ce qui appartiendrait à d'AUTRES organisations (auquel cas elle est refusée). */
async function measure(db: Db, sourceId: string, orgId: string, group = false) {
  const [otherOrganizations, arrTotal, arrHere, ppTotal, ppHere, services, usageTotal, usageHere] = await Promise.all([
    db.tierOrganization.count({ where: { tierId: sourceId, organizationId: { not: orgId } } }),
    db.arrangementTic.count({ where: { tierId: sourceId } }), db.arrangementTic.count({ where: { tierId: sourceId, organizationId: orgId } }),
    db.partiePrenante.count({ where: { tierId: sourceId } }), db.partiePrenante.count({ where: { tierId: sourceId, analyse: { organizationId: orgId } } }),
    db.tierService.count({ where: { tierId: sourceId } }),
    db.tierServiceUsage.count({ where: { tierService: { tierId: sourceId } } }), db.tierServiceUsage.count({ where: { tierService: { tierId: sourceId }, organizationId: orgId } }),
  ])
  return {
    exposure: { otherOrganizations, foreignArrangements: arrTotal - arrHere, foreignParties: ppTotal - ppHere, foreignUsages: usageTotal - usageHere },
    // Administrateur du groupe : l'aperçu annonce TOUT ce qui est déplacé, filiales comprises.
    counts: group
      ? { arrangements: arrTotal, parties: ppTotal, services, usages: usageTotal, organizations: otherOrganizations }
      : { arrangements: arrHere, parties: ppHere, services, usages: usageHere, organizations: 0 },
  }
}

async function load(sourceId: string, targetId: string, orgId: string) {
  if (!sourceId || !targetId) return { status: 400 as const, error: 'invalid_request' }
  if (!(await tierGranted(sourceId, orgId)) || !(await tierGranted(targetId, orgId))) return { status: 404 as const, error: 'not_found' }
  const tiers = await prisma.tier.findMany({ where: { id: { in: [sourceId, targetId] } }, select: { id: true, nom: true, lei: true, pays: true, aliases: true, rootOrganizationId: true } })
  const source = tiers.find(t => t.id === sourceId); const target = tiers.find(t => t.id === targetId)
  if (!source || !target) return { status: 404 as const, error: 'not_found' }
  return { source, target }
}
const asAliases = (v: unknown): string[] => (Array.isArray(v) ? v.filter((a): a is string => typeof a === 'string') : [])
const conflictStatus = (e: MergeError) => (e === 'same_tier' ? 400 : 409)

/** Aperçu de la fusion de `sourceId` dans `targetId` : relations déplacées et éventuel blocage, sans écriture. */
export async function GET(req: NextRequest) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const url = new URL(req.url)
  const loaded = await load(url.searchParams.get('sourceId') ?? '', url.searchParams.get('targetId') ?? '', ctx.orgId)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const { source, target } = loaded
  const sides = [{ id: source.id, lei: source.lei, root: source.rootOrganizationId }, { id: target.id, lei: target.lei, root: target.rootOrganizationId }] as const
  const groupAdmin = isGroupAdminMerge(ctx, sides[0], sides[1])
  const measured = await measure(prisma, source.id, ctx.orgId, groupAdmin)
  const plan = planTierMerge(sides[0], sides[1], measured.exposure, { groupAdmin })
  return NextResponse.json({ ...(plan.ok ? { ok: true } : { ok: false, error: plan.error }), groupAdmin, source: { id: source.id, nom: source.nom }, target: { id: target.id, nom: target.nom }, counts: measured.counts })
}

/**
 * Fusionne `sourceId` dans `targetId` (ADMIN ou 2ᵉ ligne) : contrats, parties prenantes et offres sont déplacés vers le tiers conservé, le
 * nom absorbé devient un alias, l'ancienne identité est supprimée. Refusée si des données d'une autre organisation seraient touchées.
 */
export async function POST(req: NextRequest) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const body = await req.json().catch(() => ({}))
  const sourceId = typeof body.sourceId === 'string' ? body.sourceId : ''; const targetId = typeof body.targetId === 'string' ? body.targetId : ''
  const preliminary = await load(sourceId, targetId, ctx.orgId)
  if ('error' in preliminary) return NextResponse.json({ error: preliminary.error }, { status: preliminary.status })

  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}), hashtext('tier-merge'))::text`)
    // Tout est relu et recontrôlé DANS la transaction : l'état peut avoir changé depuis l'aperçu.
    const tiers = await tx.tier.findMany({ where: { id: { in: [sourceId, targetId] } }, select: { id: true, nom: true, lei: true, pays: true, aliases: true, rootOrganizationId: true } })
    const source = tiers.find(t => t.id === sourceId); const target = tiers.find(t => t.id === targetId)
    if (!source || !target) return { error: 'not_found' as const }
    const sides = [{ id: source.id, lei: source.lei, root: source.rootOrganizationId }, { id: target.id, lei: target.lei, root: target.rootOrganizationId }] as const
    const groupAdmin = isGroupAdminMerge(ctx, sides[0], sides[1])
    const measured = await measure(tx as unknown as Db, source.id, ctx.orgId, groupAdmin)
    const plan = planTierMerge(sides[0], sides[1], measured.exposure, { groupAdmin })
    if (!plan.ok) return { error: plan.error }
    // Sans droit de groupe, seules les données de l'organisation sont concernées (le contrôle ci-dessus a garanti qu'il n'y a rien d'autre).
    await tx.arrangementTic.updateMany({ where: { tierId: source.id, ...(groupAdmin ? {} : { organizationId: ctx.orgId }) }, data: { tierId: target.id } })
    await tx.partiePrenante.updateMany({ where: { tierId: source.id }, data: { tierId: target.id } })
    await tx.tierService.updateMany({ where: { tierId: source.id }, data: { tierId: target.id } })
    if (groupAdmin) {
      // Les filiales qui avaient accès à l'identité absorbée gardent un accès à l'identité conservée (jamais d'accès perdu ni élargi).
      const [grants, already] = await Promise.all([
        tx.tierOrganization.findMany({ where: { tierId: source.id }, select: { organizationId: true } }),
        tx.tierOrganization.findMany({ where: { tierId: target.id }, select: { organizationId: true } }),
      ])
      const have = new Set(already.map(g => g.organizationId))
      const missing = grants.filter(g => !have.has(g.organizationId))
      if (missing.length) await tx.tierOrganization.createMany({ data: missing.map(g => ({ tierId: target.id, organizationId: g.organizationId })) })
    }
    await tx.tierOrganization.deleteMany({ where: { tierId: source.id } })
    await tx.tier.update({ where: { id: target.id }, data: {
      aliases: mergeAliases({ nom: target.nom, aliases: asAliases(target.aliases) }, { nom: source.nom, aliases: asAliases(source.aliases) }),
      ...(!normalizeLei(target.lei) && normalizeLei(source.lei) ? { lei: normalizeLei(source.lei) } : {}),
      ...(!target.pays && source.pays ? { pays: source.pays } : {}),
    } })
    await tx.tier.delete({ where: { id: source.id } })
    return { ok: true as const, groupAdmin, counts: measured.counts, sourceNom: source.nom, targetNom: target.nom }
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.error === 'not_found' ? 404 : conflictStatus(result.error as MergeError) })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: result.groupAdmin ? 'merge-group' : 'merge', sourceId, targetId, source: result.sourceNom, target: result.targetNom, moved: result.counts } })
  return NextResponse.json({ ok: true, counts: result.counts })
}
