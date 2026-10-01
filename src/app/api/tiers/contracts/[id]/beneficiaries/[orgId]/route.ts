import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { decideBeneficiaryTransition } from '@/lib/tier-contract-coverage'
import { isAdminRole, type UserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

// Confirmation locale obligatoire : un droit ADMIN hérité du groupe ne suffit pas.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; orgId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { id, orgId } = await params
  const body = await req.json().catch(() => ({}))
  if (body.decision !== 'CONFIRM' && body.decision !== 'REJECT') {
    return NextResponse.json({ error: 'invalid_decision' }, { status: 400 })
  }

  const arrangement = await prisma.arrangementTic.findUnique({ where: { id }, select: { id: true, organizationId: true, tierId: true, tier: { select: { rootOrganizationId: true } } } })
  if (!arrangement?.tierId) return NextResponse.json({ error: 'contract_not_found' }, { status: 404 })
  const [owner, beneficiaryOrg] = await Promise.all([
    prisma.organization.findUnique({ where: { id: arrangement.organizationId }, select: { id: true, path: true } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, path: true } }),
  ])
  if (!owner || owner.path !== `/${owner.id}/` || arrangement.tier?.rootOrganizationId !== owner.id || !beneficiaryOrg || beneficiaryOrg.id === owner.id || !beneficiaryOrg.path.startsWith(owner.path)) {
    return NextResponse.json({ error: 'beneficiary_not_found' }, { status: 404 })
  }
  const membership = await prisma.orgMembership.findFirst({ where: { userId, organizationId: orgId }, select: { role: true } })
  if (!membership || !isAdminRole(membership.role as UserRole)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const cfg = await getOrgConfig(owner.id)
  if (!cfg.reglementaireActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })

  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${id}), hashtext(${orgId}))::text`)
    const current = await tx.tierContractBeneficiary.findUnique({ where: { arrangementId_organizationId: { arrangementId: id, organizationId: orgId } } })
    const decision = decideBeneficiaryTransition({
      groupOrgId: owner.id, beneficiaryOrgId: orgId, groupRootOfBeneficiary: owner.id,
      actorOrgId: orgId, actorRole: membership.role as UserRole, action: body.decision, currentStatus: current?.status ?? null,
    })
    if (!decision.ok) return decision
    const beneficiary = await tx.tierContractBeneficiary.update({
      where: { arrangementId_organizationId: { arrangementId: id, organizationId: orgId } },
      data: {
        status: decision.nextStatus,
        confirmedById: body.decision === 'CONFIRM' ? userId : null,
        confirmedAt: body.decision === 'CONFIRM' ? new Date() : null,
      },
    })
    if (body.decision === 'CONFIRM') {
      await tx.tierOrganization.upsert({
        where: { tierId_organizationId: { tierId: arrangement.tierId!, organizationId: orgId } },
        create: { tierId: arrangement.tierId!, organizationId: orgId }, update: {},
      })
    }
    return { ok: true as const, beneficiary }
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
  await auditLog(body.decision === 'CONFIRM' ? 'TIER_CONTRACT_BENEFICIARY_CONFIRMED' : 'TIER_CONTRACT_BENEFICIARY_REJECTED', {
    userId, userRole: membership.role as UserRole, organizationId: orgId, ip: getClientIp(req),
    details: { arrangementId: id },
  })
  return NextResponse.json(result.beneficiary)
}
