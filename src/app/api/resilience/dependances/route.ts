import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { hasGlobalReadDispositif, peutGererRegistreTic, type UserRole } from '@/lib/permissions'
import { analyserDependances, type FonctionDep } from '@/lib/dependances-critiques'

export const dynamic = 'force-dynamic'
const lecture = (role: UserRole) => peutGererRegistreTic(role) || hasGlobalReadDispositif(role)

/**
 * GET /api/resilience/dependances — cartographie des dépendances des fonctions critiques ou importantes (DORA) de
 * l'organisation active : délais, dépendances TIC (usages, points d'accès), contrôles, risques, incidents des 12 derniers
 * mois, écarts et concentration (lib/dependances-critiques). Module réglementaire actif ; lecture de la gouvernance.
 */
export const GET = withAccess({ org: 'active', allow: lecture }, async (_req, { orgId, role }) => {
  if (!(await getOrgConfig(orgId)).reglementaireActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
  const depuis = new Date(Date.now() - 365 * 86_400_000)
  const processus = await prisma.processus.findMany({
    where: { organizationId: orgId, actif: true, criticiteDora: { in: ['CRITIQUE', 'IMPORTANTE'] } },
    orderBy: [{ criticiteDora: 'asc' }, { nom: 'asc' }],
    select: {
      id: true, nom: true, criticiteDora: true, proprietaire: true, rtoMinutes: true, rpoMinutes: true, toleranceImpactMinutes: true,
      _count: { select: { controles: true, riskItems: true, incidents: { where: { createdAt: { gte: depuis } } } } },
      serviceUsages: {
        where: { organizationId: orgId },
        select: {
          id: true, useCase: true, criticite: true, contractServiceId: true, exposeInternet: true, perimetrePci: true, avecSi: true, interconnexion: true,
          evaluation: { select: { id: true } }, pointsAcces: { select: { hote: true } },
          contractService: { select: { arrangement: { select: { criticite: true, strategieSortie: true } } } },
          tierService: { select: { nom: true, tier: { select: { id: true, nom: true } } } },
        },
      },
      scenariosSeveres: { orderBy: { createdAt: 'asc' }, select: { id: true, intitule: true, dureeInterruptionMinutes: true, description: true, mesures: true, dateEvaluation: true } },
    },
  })
  // Dernier test de résilience RÉALISÉ par fonction sur 12 mois (lien processusId, sans relation Prisma).
  const tests = processus.length ? await prisma.testResilience.findMany({
    where: { organizationId: orgId, statut: 'REALISE', dateRealisation: { gte: depuis }, processusId: { in: processus.map(p => p.id) } },
    orderBy: { dateRealisation: 'desc' }, select: { processusId: true, dateRealisation: true, dureeRepriseMinutes: true },
  }) : []
  const dernierTest = new Map<string, { dureeRepriseMinutes: number | null; date: string }>()
  for (const t of tests) if (t.processusId && !dernierTest.has(t.processusId)) dernierTest.set(t.processusId, { dureeRepriseMinutes: t.dureeRepriseMinutes, date: t.dateRealisation!.toISOString().slice(0, 10) })
  const fonctions: FonctionDep[] = processus.map(p => ({
    id: p.id, nom: p.nom, criticiteDora: p.criticiteDora!, proprietaire: p.proprietaire,
    rtoMinutes: p.rtoMinutes, rpoMinutes: p.rpoMinutes, toleranceImpactMinutes: p.toleranceImpactMinutes,
    nbControles: p._count.controles, nbRisques: p._count.riskItems, nbIncidents12m: p._count.incidents,
    usages: p.serviceUsages.map(u => ({
      id: u.id, useCase: u.useCase, tiersId: u.tierService.tier.id, tiersNom: u.tierService.tier.nom, offre: u.tierService.nom,
      criticite: u.criticite, couvert: !!u.contractServiceId, evalue: !!u.evaluation,
      exposeInternet: u.exposeInternet, perimetrePci: u.perimetrePci, avecSi: u.avecSi, interconnexion: u.interconnexion,
      hotes: [...new Set(u.pointsAcces.map(pa => pa.hote))],
      contratSansSortie: !!u.contractService && ['CRITIQUE', 'IMPORTANTE'].includes(u.contractService.arrangement.criticite) && !u.contractService.arrangement.strategieSortie?.trim(),
    })),
    dernierTest: dernierTest.get(p.id) ?? null,
    scenarios: p.scenariosSeveres.map(sc => ({ id: sc.id, intitule: sc.intitule, dureeInterruptionMinutes: sc.dureeInterruptionMinutes })),
  }))
  const scenariosDetail = Object.fromEntries(processus.flatMap(p => p.scenariosSeveres.map(sc => [sc.id, { description: sc.description, mesures: sc.mesures, dateEvaluation: sc.dateEvaluation?.toISOString().slice(0, 10) ?? null }])))
  return NextResponse.json({ ...analyserDependances(fonctions), scenariosDetail, peutModifier: peutGererRegistreTic(role) })
})
