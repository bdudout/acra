import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { decideBeneficiaryTransition } from '@/lib/tier-contract-coverage'
import { isAdminRole, type UserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

// Le propriétaire d'un contrat groupe est l'organisation racine du groupe.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = (session.user as { role?: UserRole }).role ?? 'ANALYSTE'
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
  if (!organizationId) return NextResponse.json({ error: 'organization_required' }, { status: 400 })

  const arrangement = await prisma.arrangementTic.findUnique({ where: { id }, select: { id: true, organizationId: true, tierId: true, tier: { select: { rootOrganizationId: true } } } })
  if (!arrangement?.tierId) return NextResponse.json({ error: 'contract_not_found' }, { status: 404 })
  const owner = await prisma.organization.findUnique({ where: { id: arrangement.organizationId }, select: { id: true, path: true } })
  if (!owner || owner.path !== `/${owner.id}/` || arrangement.tier?.rootOrganizationId !== owner.id) return NextResponse.json({ error: 'contract_not_group_owned' }, { status: 404 })
  const role = await getEffectiveRoleForOrg(userId, instanceRole, owner.id)
  if (!role || !isAdminRole(role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const cfg = await getOrgConfig(owner.id)
  if (!cfg.reglementaireActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })

  const beneficiaryOrg = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, path: true } })
  if (!beneficiaryOrg || beneficiaryOrg.id === owner.id || !beneficiaryOrg.path.startsWith(owner.path)) {
    return NextResponse.json({ error: 'beneficiary_not_found' }, { status: 404 })
  }

  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${id}), hashtext(${organizationId}))::text`)
    const current = await tx.tierContractBeneficiary.findUnique({ where: { arrangementId_organizationId: { arrangementId: id, organizationId } } })
    const decision = decideBeneficiaryTransition({
      groupOrgId: owner.id, beneficiaryOrgId: organizationId, groupRootOfBeneficiary: owner.id,
      actorOrgId: owner.id, actorRole: role, action: 'PROPOSE', currentStatus: current?.status ?? null,
    })
    if (!decision.ok) return decision
    const beneficiary = await tx.tierContractBeneficiary.upsert({
      where: { arrangementId_organizationId: { arrangementId: id, organizationId } },
      create: { arrangementId: id, organizationId, status: 'PROPOSED', proposedById: userId },
      update: { status: 'PROPOSED', proposedById: userId, proposedAt: new Date(), confirmedById: null, confirmedAt: null },
    })
    return { ok: true as const, beneficiary }
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === 'already_confirmed' ? 409 : 403 })
  await auditLog('TIER_CONTRACT_BENEFICIARY_PROPOSED', {
    userId, userRole: role, organizationId: owner.id, ip: getClientIp(req),
    details: { arrangementId: id, beneficiaryOrganizationId: organizationId },
  })
  return NextResponse.json(result.beneficiary, { status: 201 })
}
