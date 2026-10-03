// ─── Politique de sauvegarde planifiée (quotidienne / hebdomadaire / mensuelle) ───
// POST { policy } : valide la politique et dépose une demande `backup-policy` pour l'agent hôte, qui l'écrit dans
// `.acra-update/backup-policy.json` (l'application ne lance aucune commande et n'écrit pas ce fichier). SUPER_ADMIN.

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { buildBackupPolicyRequest } from '@/lib/update-request'
import { readUpdateAgent, requestPending, writeUpdateRequest } from '@/lib/update-request.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const body = await req.json().catch(() => ({})) as { policy?: unknown }
  let request
  try { request = buildBackupPolicyRequest({ policy: body.policy, userId: g.user.id, now: new Date(), id: randomUUID() }) }
  catch { return NextResponse.json({ error: 'invalid_policy' }, { status: 400 }) }
  const agent = await readUpdateAgent()
  if (!agent.agentAvailable) return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 })
  if (await requestPending()) return NextResponse.json({ error: 'request_pending' }, { status: 409 })
  try { await writeUpdateRequest(request) } catch { return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 }) }
  const p = request.policy
  await auditLog('INSTANCE_BACKUP_POLICY_CHANGED', {
    userId: g.user.id, userRole: g.user.role, targetType: 'instance', targetId: request.id, ip: getClientIp(req),
    details: { daily: p.daily.enabled ? p.daily.keep : 0, weekly: p.weekly.enabled ? p.weekly.keep : 0, monthly: p.monthly.enabled ? p.monthly.keep : 0, hour: p.hour },
  })
  return NextResponse.json({ requested: true, id: request.id }, { status: 202 })
}
