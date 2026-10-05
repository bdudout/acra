// ─── Sauvegarde manuelle immédiate (SUPER_ADMIN) ───
// Dépose une demande `backup-now` pour l'agent hôte, qui crée un point `manual` (l'application n'exécute aucune commande).

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { buildBackupNowRequest } from '@/lib/update-request'
import { readUpdateAgent, requestPending, writeUpdateRequest } from '@/lib/update-request.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const agent = await readUpdateAgent()
  if (agent.run) return NextResponse.json({ error: 'update_in_progress' }, { status: 409 })
  if (!agent.agentAvailable) return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 })
  if (await requestPending()) return NextResponse.json({ error: 'request_pending' }, { status: 409 })
  const request = buildBackupNowRequest({ userId: g.user.id, now: new Date(), id: randomUUID() })
  try { await writeUpdateRequest(request) } catch { return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 }) }
  await auditLog('INSTANCE_BACKUP_REQUESTED', { userId: g.user.id, userRole: g.user.role, targetType: 'instance', targetId: request.id, ip: getClientIp(req) })
  return NextResponse.json({ requested: true, id: request.id }, { status: 202 })
}
