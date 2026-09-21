import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDemoInstance } from '@/lib/demo-server'
import { canSelfDeleteAccount } from '@/lib/self-service-account'
import { auditLog, getClientIp } from '@/lib/logger'
import { deletableOrganizationIds } from '@/lib/self-service-account'

/** Supprime le compte courant, et seulement ses organisations de démo non partagées. */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const [demo, policy] = await Promise.all([
    isDemoInstance(),
    prisma.passwordPolicy.findUnique({ where: { id: 'global' }, select: { selfServiceAccountDeletion: true } }),
  ])
  if (!canSelfDeleteAccount({ demo, enabled: policy?.selfServiceAccountDeletion === true, authenticated: !!userId })) {
    return NextResponse.json({ error: 'Indisponible' }, { status: 403 })
  }

  const memberships = await prisma.orgMembership.findMany({
    where: { userId: userId! },
    select: { organizationId: true, organization: { select: { _count: { select: { membres: true } } } } },
  })
  const organizationIds = deletableOrganizationIds(memberships.map(membership => ({
    organizationId: membership.organizationId,
    memberCount: membership.organization._count.membres,
  })))

  // Le journal reste conservé après la suppression : AuditLog n'a pas de FK User.
  await auditLog('ACCOUNT_SELF_DELETED', {
    userId,
    targetId: userId,
    targetType: 'user',
    ip: getClientIp(req),
    organizationId: null,
    details: { deletedOrganizationIds: organizationIds, preservedSharedOrganizations: memberships.length - organizationIds.length },
  })

  await prisma.$transaction(async tx => {
    // Les espaces démo sont racines ; une suppression s'effectue après vérification
    // explicite qu'aucun autre membre n'y est rattaché.
    for (const organizationId of organizationIds) {
      await tx.organization.delete({ where: { id: organizationId } })
    }
    await tx.user.delete({ where: { id: userId! } })
  })
  return NextResponse.json({ ok: true })
}
