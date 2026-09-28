// ─── Mise à jour d'une instance auto-hébergée depuis l'interface (#185) ──────
// GET  — disponibilité de l'agent hôte + dernier statut de mise à jour.
// POST — { channel: 'stable' | 'beta' } : dépose une demande pour l'agent hôte.
// L'application n'exécute AUCUNE commande : l'agent (scripts/update-agent.sh)
// sauvegarde, met à jour (git), reconstruit et vérifie la santé. SUPER_ADMIN.

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canAdminInstance, type UserRole } from '@/lib/permissions'
import { isUpdateChannel } from '@/lib/version-check'
import { buildUpdateRequest } from '@/lib/update-request'
import { readUpdateAgent, writeUpdateRequest } from '@/lib/update-request.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function superAdmin() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) return { ok: false as const, res: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const role = (user.role ?? 'LECTEUR') as UserRole
  if (!canAdminInstance({ id: user.id, role })) return { ok: false as const, res: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }) }
  return { ok: true as const, userId: user.id, role }
}

export async function GET() {
  const a = await superAdmin()
  if (!a.ok) return a.res
  return NextResponse.json(await readUpdateAgent())
}

export async function POST(req: NextRequest) {
  const a = await superAdmin()
  if (!a.ok) return a.res
  const body = await req.json().catch(() => ({})) as { channel?: unknown }
  if (!isUpdateChannel(body.channel)) return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  const agent = await readUpdateAgent()
  if (!agent.agentAvailable) return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 })
  if (agent.status?.state === 'RUNNING' || agent.status?.state === 'PENDING') return NextResponse.json({ error: 'update_in_progress' }, { status: 409 })
  const request = buildUpdateRequest({ channel: body.channel, userId: a.userId, now: new Date(), id: randomUUID() })
  try { await writeUpdateRequest(request) } catch { return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 }) }
  await auditLog('ADMIN_ACTION', { userId: a.userId, userRole: a.role, targetType: 'instance', targetId: request.id, ip: getClientIp(req), details: { scope: 'instance-update-request', channel: request.channel } })
  return NextResponse.json({ requested: true, id: request.id, channel: request.channel }, { status: 202 })
}
