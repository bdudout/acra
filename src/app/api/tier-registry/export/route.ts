import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { tierContext } from '@/lib/tier-registry.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { resolveEchelles, type EchellesEcosysteme } from '@/lib/ecosystem-echelles'
import { coterEvaluation, prochaineEvaluation, sanitizeEvaluationTiers } from '@/lib/tier-evaluation'
import { buildTierEvaluationWorkbook, type LangueExport } from '@/lib/tier-evaluation-xlsx'

export const dynamic = 'force-dynamic'
const LANGUES: LangueExport[] = ['fr', 'en', 'de', 'es', 'it']

/**
 * Lot T2 — export Excel des évaluations d'usages de services tiers : organisation active, ou sous-arbre VISIBLE pour une
 * tête de groupe (mêmes règles que la liste des tiers) ; une ligne par usage, évalué ou non.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const got = await tierContext(); if ('error' in got) return got.error
  const { ctx } = got
  const lang = (LANGUES.find(l => l === req.nextUrl.searchParams.get('lang')) ?? 'fr') as LangueExport
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { path: true } })
  const sousArbre = org ? await prisma.organization.findMany({ where: { path: { startsWith: org.path }, actif: true }, select: { id: true, nom: true } }) : []
  const visibles = new Set([...(ctx.scope.visibleOrgIds ?? []), ctx.orgId])
  const orgs = sousArbre.filter(o => visibles.has(o.id))
  const nomOrg = new Map(orgs.map(o => [o.id, o.nom]))
  const echelles = resolveEchelles((await getOrgConfig(ctx.orgId)).echellesEcosysteme as Partial<EchellesEcosysteme> | null)
  const usages = orgs.length ? await prisma.tierServiceUsage.findMany({
    where: { organizationId: { in: orgs.map(o => o.id) } },
    select: { organizationId: true, useCase: true, criticite: true, processus: { select: { nom: true } }, tierService: { select: { nom: true, tier: { select: { nom: true } } } }, evaluation: { select: { statut: true, actuelle: true, cible: true, clauses: true, valideLe: true } } },
    orderBy: [{ organizationId: 'asc' }, { createdAt: 'asc' }], take: 5000,
  }) : []
  const lignes = usages.map(u => {
    const saisie = u.evaluation ? sanitizeEvaluationTiers({ actuelle: u.evaluation.actuelle, cible: u.evaluation.cible, clauses: u.evaluation.clauses }, echelles) : null
    const c = saisie ? coterEvaluation(saisie, echelles) : { actuelle: null, cible: null }
    const brief = (n: typeof c.actuelle) => (n ? { menace: n.menace, zone: n.zone } : null)
    return {
      tiers: u.tierService.tier.nom, offre: u.tierService.nom, organisation: nomOrg.get(u.organizationId) ?? '', usage: u.useCase, processus: u.processus?.nom ?? null, criticite: u.criticite,
      statut: u.evaluation?.statut ?? null, actuelle: brief(c.actuelle), cible: brief(c.cible), prochaine: prochaineEvaluation(u.evaluation?.valideLe ?? null)?.toISOString().slice(0, 10) ?? null, clauses: saisie?.clauses ?? [],
    }
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'evaluation-export', lignes: lignes.length } })
  const buf = await buildTierEvaluationWorkbook(lignes, lang)
  return new NextResponse(buf as unknown as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="evaluation-tiers.xlsx"', 'Cache-Control': 'no-store' } })
}
