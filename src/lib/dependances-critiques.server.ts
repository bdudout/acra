// ─── Chargement des fonctions critiques ou importantes (DORA) d'une organisation ─────────────────────────────────────
// Partagé par la cartographie des dépendances (GET /api/resilience/dependances) et les risques proposés
// (lib/propositions-risques-tic.server) : un seul point de lecture, toujours borné à `orgId`.
import { prisma } from '@/lib/prisma'
import type { FonctionDep } from '@/lib/dependances-critiques'

export type ScenariosDetail = Record<string, { description: string | null; mesures: string | null; dateEvaluation: string | null }>

export async function chargerFonctionsCritiques(orgId: string): Promise<{ fonctions: FonctionDep[]; scenariosDetail: ScenariosDetail }> {
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
          evaluation: { select: { id: true, statut: true, valideLe: true } }, pointsAcces: { select: { hote: true } },
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
      evaluation: u.evaluation ? { statut: u.evaluation.statut, valideLe: u.evaluation.valideLe?.toISOString() ?? null } : null,
    })),
    dernierTest: dernierTest.get(p.id) ?? null,
    scenarios: p.scenariosSeveres.map(sc => ({ id: sc.id, intitule: sc.intitule, dureeInterruptionMinutes: sc.dureeInterruptionMinutes })),
  }))
  const scenariosDetail: ScenariosDetail = Object.fromEntries(processus.flatMap(p => p.scenariosSeveres.map(sc => [sc.id, { description: sc.description, mesures: sc.mesures, dateEvaluation: sc.dateEvaluation?.toISOString().slice(0, 10) ?? null }])))
  return { fonctions, scenariosDetail }
}
