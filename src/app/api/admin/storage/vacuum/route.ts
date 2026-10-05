// ─── VACUUM (ANALYZE) simple sur les tables à lignes mortes (SUPER_ADMIN) ───
// Sans verrou exclusif (lectures/écritures continuent) ; ne rend pas forcément l'espace à l'OS. Jamais VACUUM FULL.
import { NextRequest, NextResponse } from 'next/server'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { vacuumTables } from '@/lib/storage-usage.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const body = await req.json().catch(() => ({})) as { tables?: unknown }
  const r = await vacuumTables(body.tables)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
  if (r.vacuumed.length === 0) return NextResponse.json({ error: 'nothing_to_vacuum' }, { status: 400 })
  await auditLog('INSTANCE_VACUUM_RUN', { userId: g.user.id, userRole: g.user.role, targetType: 'instance', ip: getClientIp(req), details: { tables: r.vacuumed } })
  return NextResponse.json({ vacuumed: r.vacuumed, skipped: r.skipped })
}
