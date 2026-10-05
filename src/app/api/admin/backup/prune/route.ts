// ─── Libérer de l'espace : suppression des points de restauration au-delà des N plus récents ───
// POST { keepScheduled, keepPreUpdate, keepManual, includeManual, confirmCount? } (SUPER_ADMIN).
// Sans `confirmCount` : aperçu (aucune écriture). Avec `confirmCount` égal au nombre de points à supprimer : la sélection est
// recalculée ICI (le client ne fournit jamais la liste) et déposée en demande `backup-prune` pour l'agent hôte.

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { selectBackupsToPrune } from '@/lib/snapshot'
import { buildBackupPruneRequest } from '@/lib/update-request'
import { readUpdateAgent, requestPending, writeUpdateRequest } from '@/lib/update-request.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const brief = (e: { id: string; reason: string; createdAt: string; version: string; sizeBytes: number }) => ({ id: e.id, reason: e.reason, createdAt: e.createdAt, version: e.version, sizeBytes: e.sizeBytes })

export async function POST(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const agent = await readUpdateAgent()
  if (agent.run) return NextResponse.json({ error: 'update_in_progress' }, { status: 409 })
  let sel
  try {
    sel = selectBackupsToPrune({ snapshots: agent.snapshots }, {
      keepScheduled: Number(b.keepScheduled), keepPreUpdate: Number(b.keepPreUpdate), keepManual: Number(b.keepManual),
      includeManual: b.includeManual === true, protectedIds: [],
    })
  } catch { return NextResponse.json({ error: 'keep_min_1' }, { status: 400 }) }
  if (b.confirmCount === undefined) {
    return NextResponse.json({ toDelete: sel.toDelete.map(brief), toKeep: sel.toKeep.map(brief), reclaimedBytes: sel.reclaimedBytes })
  }
  if (sel.toDelete.length === 0) return NextResponse.json({ error: 'nothing_to_prune' }, { status: 400 })
  if (b.confirmCount !== sel.toDelete.length) return NextResponse.json({ error: 'confirm_mismatch' }, { status: 400 })
  let request
  try { request = buildBackupPruneRequest({ ids: sel.toDelete.map(e => e.id), index: { snapshots: agent.snapshots }, protectedIds: [], userId: g.user.id, now: new Date(), id: randomUUID() }) }
  catch (e) { return NextResponse.json({ error: e instanceof Error && ['last_verified_point', 'too_many'].includes(e.message) ? e.message : 'invalid_request' }, { status: 400 }) }
  if (!agent.agentAvailable) return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 })
  if (await requestPending()) return NextResponse.json({ error: 'request_pending' }, { status: 409 })
  try { await writeUpdateRequest(request) } catch { return NextResponse.json({ error: 'agent_unavailable' }, { status: 409 }) }
  await auditLog('INSTANCE_BACKUP_PRUNED', {
    userId: g.user.id, userRole: g.user.role, targetType: 'instance', targetId: request.id, ip: getClientIp(req),
    details: { count: request.ids.length, bytes: sel.reclaimedBytes, ids: request.ids },
  })
  return NextResponse.json({ requested: true, id: request.id, count: request.ids.length }, { status: 202 })
}
