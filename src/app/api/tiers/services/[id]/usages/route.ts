import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { cleanUsageCriticality } from '@/lib/tier-offers'
import { validateServiceUsage } from '@/lib/tier-contract-coverage'

export const dynamic = 'force-dynamic'

/** Chaque ligne créée représente un cas métier, et non une copie du prestataire. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = (session.user as { role?: UserRole }).role ?? 'ANALYSTE'
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
  const useCase = typeof body.useCase === 'string' ? body.useCase.trim() : ''
  const processId = typeof body.processusId === 'string' ? body.processusId.trim() : ''
  const contractServiceId = typeof body.contractServiceId === 'string' ? body.contractServiceId.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : null
  if (!organizationId || !useCase || useCase.length > 1000 || (description && description.length > 10000)) {
    return NextResponse.json({ error: 'invalid_usage_input' }, { status: 400 })
  }

  const crit = cleanUsageCriticality(body.criticite)
  if (!crit.ok) return NextResponse.json({ error: 'invalid_usage_input' }, { status: 400 })

  const role = await getEffectiveRoleForOrg(userId, instanceRole, organizationId)
  if (!role || !isAdminRole(role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const cfg = await getOrgConfig(organizationId)
  if (!cfg.reglementaireActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })

  const service = await prisma.tierService.findUnique({
    where: { id },
    select: { id: true, tierId: true, actif: true, tier: { select: { rootOrganizationId: true, organizations: { where: { organizationId }, select: { organizationId: true } } } } },
  })
  if (!service?.actif) return NextResponse.json({ error: 'service_not_found' }, { status: 404 })
  const serviceAccessible = service.tier.rootOrganizationId === organizationId || service.tier.organizations.length > 0
  if (!serviceAccessible) return NextResponse.json({ error: 'service_not_accessible' }, { status: 403 })

  const process = processId
    ? await prisma.processus.findUnique({ where: { id: processId }, select: { id: true, organizationId: true } })
    : null
  if (processId && !process) return NextResponse.json({ error: 'process_not_found' }, { status: 404 })
  const contractService = contractServiceId
    ? await prisma.tierContractService.findUnique({
        where: { id: contractServiceId },
        select: { id: true, arrangementId: true, tierServiceId: true, arrangement: { select: { organizationId: true, tierId: true } } },
      })
    : null
  if (contractServiceId && (!contractService || contractService.tierServiceId !== id || contractService.arrangement.tierId !== service.tierId)) {
    return NextResponse.json({ error: 'contract_service_not_found' }, { status: 404 })
  }
  const beneficiary = contractService && contractService.arrangement.organizationId !== organizationId
    ? await prisma.tierContractBeneficiary.findUnique({ where: { arrangementId_organizationId: { arrangementId: contractService.arrangementId, organizationId } } })
    : null
  const decision = validateServiceUsage({
    organizationId, processOrganizationId: process?.organizationId ?? null,
    serviceId: id, serviceAccessible, useCase,
    contractService: contractService ? { id: contractService.id, contractId: contractService.arrangementId, serviceId: contractService.tierServiceId } : null,
    contractOwnerOrganizationId: contractService?.arrangement.organizationId ?? null,
    beneficiary: beneficiary ? { contractId: beneficiary.arrangementId, organizationId: beneficiary.organizationId, status: beneficiary.status } : null,
  })
  if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.error === 'beneficiary_not_confirmed' || decision.error === 'beneficiary_contract_mismatch' ? 409 : 400 })

  const created = await prisma.tierServiceUsage.create({
    data: { organizationId, tierServiceId: id, processusId: process?.id ?? null, contractServiceId: contractService?.id ?? null, useCase, description, criticite: crit.value },
  })
  await auditLog('TIER_SERVICE_USAGE_CREATED', {
    userId, userRole: role, organizationId, ip: getClientIp(req),
    details: { usageId: created.id, serviceId: id, coverage: decision.coverage },
  })
  return NextResponse.json({ ...created, coverage: decision.coverage }, { status: 201 })
}
