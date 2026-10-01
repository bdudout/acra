import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tierContext, tierGranted } from '@/lib/tier-registry.server'
import { usageCoverage, usageCriticalityGap } from '@/lib/tier-offers'
import type { NiveauCriticite } from '@/lib/registre-tic'

export const dynamic = 'force-dynamic'

/**
 * Fiche d'un tiers autorisé : offres, contrats (de l'organisation, ou groupe dont elle est bénéficiaire CONFIRMÉE) et couverture
 * des offres, usages DE L'ORGANISATION ACTIVE avec leur couverture contractuelle. Aucune donnée d'une autre filiale.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const got = await tierContext(); if ('error' in got) return got.error
  const { ctx } = got
  const { id } = await params
  if (!(await tierGranted(id, ctx.orgId))) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const [tier, services, arrangements, usages] = await Promise.all([
    prisma.tier.findUnique({ where: { id }, select: { id: true, nom: true, lei: true, pays: true } }),
    prisma.tierService.findMany({ where: { tierId: id }, select: { id: true, nom: true, typeService: true, description: true, actif: true }, orderBy: { nom: 'asc' } }),
    prisma.arrangementTic.findMany({
      where: { tierId: id, OR: [{ organizationId: ctx.orgId }, { beneficiaries: { some: { organizationId: ctx.orgId, status: 'CONFIRMED' } } }] },
      select: { id: true, reference: true, organizationId: true, criticite: true, beneficiaries: { where: { organizationId: ctx.orgId }, select: { organizationId: true, status: true } }, servicesCouverts: { select: { id: true, tierServiceId: true, perimetre: true, dateDebut: true, dateFin: true } } },
      orderBy: { reference: 'asc' },
    }),
    prisma.tierServiceUsage.findMany({
      where: { organizationId: ctx.orgId, tierService: { tierId: id } },
      select: { id: true, useCase: true, description: true, tierServiceId: true, processusId: true, processus: { select: { nom: true } }, contractServiceId: true, criticite: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  // Organisation RACINE (contrats groupe) : l'ADMIN voit l'état de chaque filiale bénéficiaire et celles qu'il peut encore proposer.
  const org = ctx.isAdmin ? await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { id: true, path: true } }) : null
  const isGroupRoot = !!org && org.path === `/${org.id}/`
  const ownedIds = arrangements.filter(a => a.organizationId === ctx.orgId).map(a => a.id)
  const [benRows, descendants] = isGroupRoot && ownedIds.length
    ? await Promise.all([
        prisma.tierContractBeneficiary.findMany({ where: { arrangementId: { in: ownedIds } }, select: { arrangementId: true, organizationId: true, status: true, organization: { select: { nom: true } } } }),
        prisma.organization.findMany({ where: { path: { startsWith: org!.path }, id: { not: org!.id }, actif: true }, select: { id: true, nom: true }, orderBy: { nom: 'asc' } }),
      ])
    : [[], []]
  const contractServices = arrangements.flatMap(a => a.servicesCouverts.map(cs => ({ id: cs.id, arrangementId: a.id, reference: a.reference, serviceId: cs.tierServiceId, owner: a.organizationId, status: a.beneficiaries[0]?.status ?? null, criticite: a.criticite as NiveauCriticite })))
  const csById = new Map(contractServices.map(cs => [cs.id, cs]))
  return NextResponse.json({
    tier,
    orgId: ctx.orgId, canManage: ctx.canManage, isAdmin: ctx.isAdmin,
    contracts: arrangements.map(a => {
      const beneficiaries = benRows.filter(b => b.arrangementId === a.id).map(b => ({ organizationId: b.organizationId, nom: b.organization.nom, status: b.status }))
      const taken = new Set(beneficiaries.filter(b => b.status === 'CONFIRMED' || b.status === 'PROPOSED').map(b => b.organizationId))
      return { id: a.id, reference: a.reference, ownedHere: a.organizationId === ctx.orgId, serviceIds: a.servicesCouverts.map(cs => cs.tierServiceId),
        // Périmètre et dates par offre : visibles seulement pour les contrats de l'organisation (jamais ceux d'un contrat groupe d'une autre).
        details: a.organizationId === ctx.orgId ? Object.fromEntries(a.servicesCouverts.map(cs => [cs.tierServiceId, { perimetre: cs.perimetre, dateDebut: cs.dateDebut?.toISOString().slice(0, 10) ?? null, dateFin: cs.dateFin?.toISOString().slice(0, 10) ?? null }])) : {},
        beneficiaries, proposable: a.organizationId === ctx.orgId ? descendants.filter(o => !taken.has(o.id)) : [] }
    }),
    contractServices: contractServices.map(({ id: csId, arrangementId, reference, serviceId }) => ({ id: csId, arrangementId, reference, serviceId })),
    services: services.map(s => ({
      ...s,
      coveredBy: contractServices.filter(cs => cs.serviceId === s.id).map(cs => ({ arrangementId: cs.arrangementId, reference: cs.reference, contractServiceId: cs.id })),
      usages: usages.filter(u => u.tierServiceId === s.id).map(u => {
        const cs = u.contractServiceId ? csById.get(u.contractServiceId) : undefined
        return { id: u.id, useCase: u.useCase, description: u.description, processusId: u.processusId, processusNom: u.processus?.nom ?? null, contractServiceId: u.contractServiceId, criticite: u.criticite,
          criticiteContrat: cs?.criticite ?? null, criticiteEcart: usageCriticalityGap(u.criticite as NiveauCriticite | null, cs?.criticite ?? null),
          coverage: usageCoverage({ organizationId: ctx.orgId, contractService: cs ? { ownerOrganizationId: cs.owner, beneficiaryStatus: cs.status as 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | null } : null }) }
      }),
    })),
  })
}
