import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdmin } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'

// GET /api/admin/audit-log
// Query params: page, limit, action, userId, from, to
// Périmètre : un ADMIN voit les logs de SON organisation (rattachement
// organizationId) ; le SUPER_ADMIN voit tout, y compris les événements
// d'instance (organizationId null).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  if (!canAdmin({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page    = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10))
  const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const action  = searchParams.get('action') ?? undefined
  const uid     = searchParams.get('userId') ?? undefined
  const from    = searchParams.get('from')   ?? undefined
  const to      = searchParams.get('to')     ?? undefined

  const where: Record<string, unknown> = {}
  if (action) where.action = action
  if (uid)    where.userId = uid
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    }
  }

  // Scoping : ADMIN limité aux organisations visibles de son périmètre.
  const scope = await getAnalyseScope(userId, userRole)
  if (!scope.scope.isSuperAdmin) {
    where.organizationId = { in: scope.scope.visibleOrgIds }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditLogModel = (prisma as any).auditLog
  const [logs, total] = await Promise.all([
    auditLogModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    auditLogModel.count({ where }),
  ])

  // Actions distinctes pour le filtre (dans le même périmètre).
  const actions = await auditLogModel.findMany({
    where: scope.scope.isSuperAdmin ? undefined : { organizationId: { in: scope.scope.visibleOrgIds } },
    select: { action: true },
    distinct: ['action'],
    orderBy: { action: 'asc' },
  })

  return NextResponse.json({
    logs,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    availableActions: actions.map((a: { action: string }) => a.action),
  })
}
