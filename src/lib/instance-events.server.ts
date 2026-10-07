// ─── Journal d'audit des événements du cycle de vie de l'instance — lot 4 ───
// Lit `.acra-update/events.log` (borné) au démarrage et écrit une entrée d'audit par événement NOUVEAU.
// Anti-doublon : table `InstanceEvent` (clé unique = la ligne). Après une restauration, la table est revenue
// à l'état du point : l'événement RESTORED y est absent, donc bien journalisé (voulu).

import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { auditLog, type AuditAction } from '@/lib/logger'
import { INSTANCE_EVENTS_MAX_BYTES, parseInstanceEvents, type InstanceEvent } from '@/lib/instance-events'
import { updateDir } from '@/lib/update-request.server'

const ACTION: Record<InstanceEvent['kind'], AuditAction> = { RESTORED: 'INSTANCE_RESTORED', UPDATED: 'INSTANCE_UPDATED', ROLLED_BACK: 'INSTANCE_UPDATE_ROLLED_BACK' }

function details(e: InstanceEvent): Record<string, string> {
  if (e.kind === 'RESTORED') return { snapshotId: e.snapshotId, at: e.at }
  if (e.kind === 'UPDATED') return { from: e.from, to: e.to, at: e.at }
  return { from: e.from, to: e.to, code: e.code, at: e.at }
}

/** Journalise les événements non encore connus ; renvoie leur nombre. Ne lève jamais (démarrage de l'application). */
export async function recordInstanceEvents(): Promise<number> {
  try {
    const file = path.join(updateDir(), 'events.log')
    const st = await fs.stat(file).catch(() => null)
    if (!st?.isFile()) return 0
    const text = await fs.readFile(file, 'utf8').then(t => t.slice(-INSTANCE_EVENTS_MAX_BYTES))
    const events = parseInstanceEvents(text)
    if (!events.length) return 0
    const known = new Set((await prisma.instanceEvent.findMany({ where: { key: { in: events.map(e => e.key) } }, select: { key: true } })).map(r => r.key))
    const fresh = events.filter((e, i) => !known.has(e.key) && events.findIndex(x => x.key === e.key) === i)
    if (!fresh.length) return 0
    await prisma.instanceEvent.createMany({ data: fresh.map(e => ({ key: e.key, kind: e.kind })), skipDuplicates: true })
    for (const e of fresh) await auditLog(ACTION[e.kind], { targetType: 'instance', targetId: e.kind, details: details(e) })
    return fresh.length
  } catch {
    return 0
  }
}
