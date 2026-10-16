// ─── Mise à jour d'une instance auto-hébergée depuis l'interface (#185) ──────
// GET  — disponibilité de l'agent hôte + dernier statut de mise à jour.
// POST — { channel: 'stable' | 'beta' } : dépose une demande pour l'agent hôte.
// L'application n'exécute AUCUNE commande : l'agent (scripts/update-agent.sh)
// sauvegarde, met à jour (git), reconstruit et vérifie la santé. SUPER_ADMIN.

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { canAdminInstance } from '@/lib/permissions'
import { isUpdateChannel } from '@/lib/version-check'
import { buildUpdateRequest } from '@/lib/update-request'
import { readUpdateAgent, writeUpdateRequest } from '@/lib/update-request.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await requireInstanceAdmin()
  if (g.error) return g.error
  return NextResponse.json(await readUpdateAgent())
}

export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'instance-update' } }, async (req, { user }) => {
  if (!canAdminInstance({ id: user.id, role: user.role })) return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { channel?: unknown }
  if (!isUpdateChannel(body.channel)) return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  const agent = await readUpdateAgent()
  if (!agent.agentAvailable) return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 })
  if (agent.status?.state === 'RUNNING' || agent.status?.state === 'PENDING') return NextResponse.json({ error: 'update_in_progress' }, { status: 409 })
  const request = buildUpdateRequest({ channel: body.channel, userId: user.id, now: new Date(), id: randomUUID() })
  try { await writeUpdateRequest(request) } catch { return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 }) }
  await auditLog('ADMIN_ACTION', { userId: user.id, userRole: user.role, targetType: 'instance', targetId: request.id, ip: getClientIp(req), details: { scope: 'instance-update-request', channel: request.channel } })
  return NextResponse.json({ requested: true, id: request.id, channel: request.channel }, { status: 202 })
})
