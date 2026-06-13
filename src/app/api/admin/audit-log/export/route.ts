import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdmin } from '@/lib/permissions'
import { toCsvCell } from '@/lib/spreadsheet-safe'

// GET /api/admin/audit-log/export — export CSV du journal d'audit (ADMIN seulement)
// Query params: action, from, to (same as audit-log route)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId   = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  if (!canAdmin({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? undefined
  const from   = searchParams.get('from')   ?? undefined
  const to     = searchParams.get('to')     ?? undefined

  const where: Record<string, unknown> = {}
  if (action) where.action = action
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = await (prisma as any).auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000, // cap à 10k lignes
  })

  // Build CSV
  const HEADERS = ['date', 'action', 'userId', 'userEmail', 'userRole', 'ip', 'targetId', 'targetType', 'details']

  // [F002 corrigé] Neutralisation de l'injection de formule (CWE-1236) déléguée à
  // toCsvCell() : les objets (ex. `details`) sont d'abord sérialisés en JSON, puis
  // toCsvCell applique sanitizeForSpreadsheet (préfixe '=+-@…) + l'échappement RFC 4180.
  // Même primitive que l'export d'analyse → durcissement cohérent entre les deux exports.
  function escapeCsv(val: unknown): string {
    return toCsvCell(typeof val === 'object' && val !== null ? JSON.stringify(val) : val)
  }

  const rows = [
    HEADERS.join(','),
    ...logs.map((log: Record<string, unknown>) =>
      HEADERS.map(h => escapeCsv(h === 'date' ? log.createdAt : log[h])).join(',')
    ),
  ]

  const csv = rows.join('\r\n')
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
