import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdmin } from '@/lib/permissions'
import { getAdminScope } from '@/lib/org-context.server'

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
  // Journal limité aux organisations ADMINISTRÉES (rôle effectif, T25).
  const scope = await getAdminScope(userId, userRole)
  if (!scope.all) {
    where.organizationId = { in: scope.orgIds }
  }

  const auditLogModel = prisma.auditLog
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
  // Instance entière (SUPER_ADMIN) : balayage d'index « sauteur » (CTE récursive sur
  // AuditLog_action_idx) au lieu d'un DISTINCT qui parcourait toute la table à chaque
  // affichage (audit 2026-09-30, T14 : 87 ms → 0,3 ms sur 1 M lignes).
  const actions: { action: string }[] = scope.all
    ? (await prisma.$queryRaw<{ a: string }[]>`
        WITH RECURSIVE t AS (
          SELECT min(action) AS a FROM "AuditLog"
          UNION ALL
          SELECT (SELECT min(action) FROM "AuditLog" WHERE action > t.a) FROM t WHERE t.a IS NOT NULL
        )
        SELECT a FROM t WHERE a IS NOT NULL`).map(r => ({ action: r.a }))
    : await auditLogModel.findMany({
        where: { organizationId: { in: scope.orgIds } },
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
