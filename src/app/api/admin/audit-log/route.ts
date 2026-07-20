import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdminInstance } from '@/lib/permissions'

// GET /api/admin/audit-log
// Query params: page, limit, action, userId, from, to
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  if (!canAdminInstance({ id: userId, role: userRole })) {
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

  // Get distinct actions for filter dropdown
  const actions = await auditLogModel.findMany({
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
