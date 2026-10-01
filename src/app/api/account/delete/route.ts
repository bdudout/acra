import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDemoInstance } from '@/lib/demo-server'
import { canSelfDeleteAccount } from '@/lib/self-service-account'
import { auditLog, getClientIp } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { rateLimit, rateLimitHeaders, LIMIT_PASSWORD } from '@/lib/rate-limit'
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

  // Action irréversible : débit limité + ré-authentification par le mot de passe courant
  // (une session volée ou laissée ouverte ne suffit plus — audit 2026-09-30, N05).
  const rl = await rateLimit(`account-delete:${userId}`, LIMIT_PASSWORD.limit, LIMIT_PASSWORD.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de tentatives' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const body = await req.json().catch(() => ({})) as { password?: unknown }
  const account = await prisma.user.findUnique({ where: { id: userId! }, select: { passwordHash: true } })
  if (!account) return NextResponse.json({ error: 'Indisponible' }, { status: 403 })
  if (account.passwordHash && !(typeof body.password === 'string' && await bcrypt.compare(body.password, account.passwordHash))) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 403 })
  }

  const memberships = await prisma.orgMembership.findMany({
    where: { userId: userId! },
    select: { organizationId: true, organization: { select: { _count: { select: { membres: true } } } } },
  })
  const organizationIds = deletableOrganizationIds(memberships.map(membership => ({
    organizationId: membership.organizationId,
    memberCount: membership.organization._count.membres,
  })))

  // Les analyses sont des preuves GRC (FK Restrict, audit 2026-09-30 D1) : celles des
  // espaces de démo supprimés partent avec eux ; une analyse dans une organisation
  // partagée bloque la suppression (elle doit d'abord être réattribuée).
  const kept = await prisma.analyse.count({ where: { userId: userId!, organizationId: { notIn: organizationIds } } })
  if (kept > 0) return NextResponse.json({ error: 'Vous êtes propriétaire d\'analyses dans une organisation partagée', code: 'OWNS_ANALYSES' }, { status: 409 })

  await prisma.$transaction(async tx => {
    // Comme la purge démo : l'espace supprimé emporte TOUTES ses analyses (sinon SET NULL → orphelines).
    await tx.analyse.deleteMany({ where: { organizationId: { in: organizationIds } } })
    // Les espaces démo sont racines ; une suppression s'effectue après vérification
    // explicite qu'aucun autre membre n'y est rattaché.
    for (const organizationId of organizationIds) {
      await tx.organization.delete({ where: { id: organizationId } })
    }
    await tx.user.delete({ where: { id: userId! } })
  })
  // Journal écrit APRÈS le commit : il n'affirme jamais une suppression qui a échoué.
  // Le journal reste conservé après la suppression : AuditLog n'a pas de FK User.
  await auditLog('ACCOUNT_SELF_DELETED', {
    userId,
    targetId: userId,
    targetType: 'user',
    ip: getClientIp(req),
    organizationId: null,
    details: { deletedOrganizationIds: organizationIds, preservedSharedOrganizations: memberships.length - organizationIds.length },
  })
  return NextResponse.json({ ok: true })
}
