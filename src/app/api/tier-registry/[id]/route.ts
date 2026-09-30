import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tierContext, tierGranted } from '@/lib/tier-registry.server'
import { usageCoverage } from '@/lib/tier-offers'

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
      select: { id: true, reference: true, organizationId: true, beneficiaries: { where: { organizationId: ctx.orgId }, select: { organizationId: true, status: true } }, servicesCouverts: { select: { id: true, tierServiceId: true } } },
      orderBy: { reference: 'asc' },
    }),
    prisma.tierServiceUsage.findMany({
      where: { organizationId: ctx.orgId, tierService: { tierId: id } },
      select: { id: true, useCase: true, description: true, tierServiceId: true, processusId: true, processus: { select: { nom: true } }, contractServiceId: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const contractServices = arrangements.flatMap(a => a.servicesCouverts.map(cs => ({ id: cs.id, arrangementId: a.id, reference: a.reference, serviceId: cs.tierServiceId, owner: a.organizationId, status: a.beneficiaries[0]?.status ?? null })))
  const csById = new Map(contractServices.map(cs => [cs.id, cs]))
  return NextResponse.json({
    tier,
    orgId: ctx.orgId, canManage: ctx.canManage, isAdmin: ctx.isAdmin,
    contracts: arrangements.map(a => ({ id: a.id, reference: a.reference, ownedHere: a.organizationId === ctx.orgId, serviceIds: a.servicesCouverts.map(cs => cs.tierServiceId) })),
    contractServices: contractServices.map(({ id: csId, arrangementId, reference, serviceId }) => ({ id: csId, arrangementId, reference, serviceId })),
    services: services.map(s => ({
      ...s,
      coveredBy: contractServices.filter(cs => cs.serviceId === s.id).map(cs => ({ arrangementId: cs.arrangementId, reference: cs.reference, contractServiceId: cs.id })),
      usages: usages.filter(u => u.tierServiceId === s.id).map(u => {
        const cs = u.contractServiceId ? csById.get(u.contractServiceId) : undefined
        return { id: u.id, useCase: u.useCase, description: u.description, processusId: u.processusId, processusNom: u.processus?.nom ?? null, contractServiceId: u.contractServiceId,
          coverage: usageCoverage({ organizationId: ctx.orgId, contractService: cs ? { ownerOrganizationId: cs.owner, beneficiaryStatus: cs.status as 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | null } : null }) }
      }),
    })),
  })
}
