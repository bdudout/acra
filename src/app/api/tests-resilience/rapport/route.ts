// ─── Rapport sur le réexamen du cadre de gestion du risque lié aux TIC ───────
// (DORA art. 6 § 5) — GET ?annee= : livrable GRC DORA global (document Word) : programme de
// tests de l'année et constats, plans d'action issus des tests, registre des arrangements TIC,
// constats du régulateur, incidents majeurs liés aux TIC de l'année et risques du registre liés.
// Accessible depuis la page Rapports (livrable de gouvernance, pas une sortie du module de tests).
// Lecture ouverte aux rôles du contexte ; rate limit d'export ; journal EXPORT.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerT } from '@/lib/i18n'
import { testsResilienceContext, TEST_SELECT, toLite } from '@/lib/tests-resilience.server'
import { buildRapportReexamen, type RapportLabels } from '@/lib/tests-resilience'
import { classifierIncident, estEvalueDora, type DoraCriteres } from '@/lib/dora'
import { niveauRisque } from '@/lib/risk-item'
import { markdownToDocxBuffer } from '@/lib/markdown-docx'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const access = await testsResilienceContext()
  if (!access.ok) return NextResponse.json({ error: 'Introuvable' }, { status: access.status })
  const { ctx } = access
  const rl = await rateLimit(`tests-resilience-rapport:${ctx.userId}`, LIMIT_EXPORT.limit, LIMIT_EXPORT.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const now = new Date()
  const annee = Number(req.nextUrl.searchParams.get('annee')) || now.getUTCFullYear()
  const debut = new Date(Date.UTC(annee, 0, 1)), fin = new Date(Date.UTC(annee + 1, 0, 1))

  const [rows, org, incidentRows, arrangements, constatsReg, actionsTests] = await Promise.all([
    prisma.testResilience.findMany({ where: { organizationId: ctx.orgId }, select: TEST_SELECT }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { nom: true, slug: true } }),
    prisma.incident.findMany({
      where: { organizationId: ctx.orgId, OR: [{ dateDetection: { gte: debut, lt: fin } }, { dateSurvenance: { gte: debut, lt: fin } }] },
      select: { intitule: true, dateDetection: true, dateSurvenance: true, doraCriteres: true },
    }),
    // Livrable GRC global : registre TIC (art. 28), constats du régulateur, plans d'action issus des tests.
    prisma.arrangementTic.findMany({ where: { organizationId: ctx.orgId }, select: { criticite: true, dateFin: true, questionnaire: true } }),
    prisma.auditConstat.findMany({ where: { organizationId: ctx.orgId, source: 'REGULATEUR' }, select: { statut: true, echeance: true } }),
    prisma.planAction.findMany({ where: { organizationId: ctx.orgId, liens: { some: { type: 'TEST_RESILIENCE' } } }, select: { statut: true, echeance: true } }),
  ])
  const termine = (st: string) => st === 'RESOLU' || st === 'VERIFIE' || st === 'ACCEPTE' || st === 'FAIT'
  const dansUnAn = new Date(now.getTime() + 365 * 86_400_000)
  const tiers = {
    total: arrangements.length,
    critiques: arrangements.filter(a => a.criticite === 'CRITIQUE' || a.criticite === 'IMPORTANTE').length,
    finProche: arrangements.filter(a => a.dateFin && a.dateFin >= now && a.dateFin <= dansUnAn).length,
    sansQuestionnaire: arrangements.filter(a => !Array.isArray(a.questionnaire) || a.questionnaire.length === 0).length,
  }
  const regulateur = { ouverts: constatsReg.filter(c => !termine(c.statut)).length, echus: constatsReg.filter(c => !termine(c.statut) && c.echeance && c.echeance < now).length }
  const actions = { total: actionsTests.length, ouvertes: actionsTests.filter(a => !termine(a.statut)).length, enRetard: actionsTests.filter(a => !termine(a.statut) && a.echeance && a.echeance < now).length }
  const tests = rows.map(toLite)
  const riskIds = [...new Set(tests.filter(t => t.annee === annee).flatMap(t => t.riskItemIds))]
  const risks = riskIds.length ? await prisma.riskItem.findMany({
    where: { organizationId: ctx.orgId, id: { in: riskIds } },
    select: { intitule: true, graviteResiduelle: true, vraisemblanceResiduelle: true },
  }) : []
  const incidents = incidentRows.filter(i => {
    const c = (i.doraCriteres ?? {}) as DoraCriteres
    return estEvalueDora(c) && classifierIncident(c).classe === 'MAJEUR'
  }).map(i => ({ intitule: i.intitule, date: (i.dateDetection ?? i.dateSurvenance)!.toISOString().slice(0, 10) }))

  const t = (await getServerT()).testsResilience
  const labels: RapportLabels = { ...t.rapport, types: t.types as Record<string, string> }
  const md = buildRapportReexamen({
    organisation: org?.nom ?? '', annee, now, tests, incidents,
    risques: risks.map(r => ({ intitule: r.intitule, niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle) })),
    tiers, regulateur, actions,
    labels,
  })
  const buffer = await markdownToDocxBuffer(t.rapport.titre, md)
  await auditLog('EXPORT', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), targetType: 'test-resilience', details: { format: 'docx', rapport: 'reexamen-cadre-tic', annee } })
  const file = `rapport-reexamen-cadre-tic-${annee}-${(org?.slug ?? 'org').replace(/[^a-z0-9-]/gi, '')}.docx`
  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${file}"`,
    },
  })
}
