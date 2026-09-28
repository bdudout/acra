import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageOrganizations, type UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'

/** Export de clôture, réservé au SUPER_ADMIN : il ne mélange jamais les organisations. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const role = ((session?.user as { role?: UserRole } | undefined)?.role ?? 'ANALYSTE') as UserRole
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canManageOrganizations({ id: (session.user as { id: string }).id, role })) {
    return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  }
  const { id } = await params
  const organization = await prisma.organization.findUnique({ where: { id }, select: { id: true, nom: true, slug: true, parentId: true, path: true } })
  if (!organization) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })

  const [analyses, riskItems, plansAction] = await Promise.all([
    prisma.analyse.findMany({
      where: { organizationId: id },
      include: { cadrage: true, sourcesRisque: true, partiesPrenantes: true, scenariosStrategiques: true, scenariosOperationnels: true, risques: true, mesures: true, revisions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.riskItem.findMany({ where: { organizationId: id } }),
    prisma.planAction.findMany({ where: { organizationId: id } }),
  ])
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), organization, analyses, riskItems, plansAction }, null, 2)
  // Export de clôture = toutes les données métier d'une organisation : tracé.
  await auditLog('EXPORT', {
    userId: (session.user as { id: string }).id, userRole: role, organizationId: organization.id,
    targetId: organization.id, targetType: 'organization', ip: getClientIp(req),
    details: { scope: 'organization-closure-export', analyses: analyses.length, riskItems: riskItems.length, plansAction: plansAction.length },
  })
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="acra-cloture-${organization.slug}-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
