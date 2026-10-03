// ─── Retour à un point de restauration depuis l'interface (docs/specs/sauvegarde-rollback-spec.md, lot 3) ───
// POST { snapshotId, confirmVersion } : dépose une demande `rollback` pour l'agent hôte. L'application n'exécute
// AUCUNE commande : l'agent valide l'identifiant contre SON index, puis appelle scripts/update.sh rollback <id>.
// SUPER_ADMIN uniquement ; l'identifiant doit figurer dans l'index publié et la version être confirmée (saisie).

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { isSnapshotId } from '@/lib/snapshot'
import { buildRollbackRequest } from '@/lib/update-request'
import { readSnapshotIndex, readUpdateAgent, writeUpdateRequest } from '@/lib/update-request.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { releaseInfo } from '@/lib/release-info'

export const dynamic = 'force-dynamic'

const Body = z.object({ snapshotId: z.string().refine(isSnapshotId), confirmVersion: z.string().min(1).max(40) })

export async function POST(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const index = await readSnapshotIndex()
  let request
  try {
    request = buildRollbackRequest({ snapshotId: parsed.data.snapshotId, confirmVersion: parsed.data.confirmVersion, index, userId: g.user.id, now: new Date(), id: randomUUID() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'invalid_request' }, { status: 400 })
  }
  const agent = await readUpdateAgent()
  if (!agent.agentAvailable) return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 })
  if (agent.status?.state === 'RUNNING' || agent.status?.state === 'PENDING' || agent.run) return NextResponse.json({ error: 'update_in_progress' }, { status: 409 })
  try { await writeUpdateRequest(request) } catch { return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 }) }
  const entry = index.snapshots.find(e => e.id === parsed.data.snapshotId)
  await auditLog('INSTANCE_ROLLBACK_REQUESTED', { userId: g.user.id, userRole: g.user.role, targetType: 'instance', targetId: request.id, ip: getClientIp(req), details: { snapshotId: request.snapshotId, fromVersion: releaseInfo(process.env).version, toVersion: entry?.version ?? '' } })
  return NextResponse.json({ requested: true, id: request.id, snapshotId: parsed.data.snapshotId }, { status: 202 })
}
