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
export const GET = withAccess({ org: 'active', allow: lecture }, async (_req, { orgId }) => {
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
          tierService: { select: { nom: true, tier: { select: { id: true, nom: true } } } },
        },
      },
    },
  })
  const fonctions: FonctionDep[] = processus.map(p => ({
    id: p.id, nom: p.nom, criticiteDora: p.criticiteDora!, proprietaire: p.proprietaire,
    rtoMinutes: p.rtoMinutes, rpoMinutes: p.rpoMinutes, toleranceImpactMinutes: p.toleranceImpactMinutes,
    nbControles: p._count.controles, nbRisques: p._count.riskItems, nbIncidents12m: p._count.incidents,
    usages: p.serviceUsages.map(u => ({
      id: u.id, useCase: u.useCase, tiersId: u.tierService.tier.id, tiersNom: u.tierService.tier.nom, offre: u.tierService.nom,
      criticite: u.criticite, couvert: !!u.contractServiceId, evalue: !!u.evaluation,
      exposeInternet: u.exposeInternet, perimetrePci: u.perimetrePci, avecSi: u.avecSi, interconnexion: u.interconnexion,
      hotes: [...new Set(u.pointsAcces.map(pa => pa.hote))],
    })),
  }))
  return NextResponse.json(analyserDependances(fonctions))
})
