// ─── Événements du cycle de vie de l'instance (PUR) — docs/specs/sauvegarde-rollback-spec.md, lot 4 ───
// `.acra-update/events.log` (écrit par les scripts) : RESTORED <id> <iso> · UPDATED <from> <to> <iso> ·
// ROLLED_BACK <from> <to> <code> <iso>. L'application les lit au démarrage et en tire des entrées d'audit.

import { isSnapshotId } from '@/lib/snapshot'

export const INSTANCE_EVENTS_MAX_BYTES = 64 * 1024
const MAX_EVENTS = 500
const VERSION = /^[0-9A-Za-z.+-]{1,40}$/
const CODE = /^[A-Za-z_]{1,40}$/
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

export type InstanceEvent =
  | { key: string; kind: 'RESTORED'; snapshotId: string; at: string }
  | { key: string; kind: 'UPDATED'; from: string; to: string; at: string }
  | { key: string; kind: 'ROLLED_BACK'; from: string; to: string; code: string; at: string }

export function parseInstanceEvents(text: string): InstanceEvent[] {
  const tail = text.length > INSTANCE_EVENTS_MAX_BYTES ? text.slice(-INSTANCE_EVENTS_MAX_BYTES) : text
  const out: InstanceEvent[] = []
  for (const line of tail.split('\n')) {
    const p = line.trim().split(/\s+/)
    const at = p[p.length - 1]
    if (!ISO.test(at ?? '') || Number.isNaN(Date.parse(at))) continue
    const key = p.join(' ')
    if (p[0] === 'RESTORED' && p.length === 3 && isSnapshotId(p[1])) out.push({ key, kind: 'RESTORED', snapshotId: p[1], at })
    else if (p[0] === 'UPDATED' && p.length === 4 && VERSION.test(p[1]) && VERSION.test(p[2])) out.push({ key, kind: 'UPDATED', from: p[1], to: p[2], at })
    else if (p[0] === 'ROLLED_BACK' && p.length === 5 && VERSION.test(p[1]) && VERSION.test(p[2]) && CODE.test(p[3])) out.push({ key, kind: 'ROLLED_BACK', from: p[1], to: p[2], code: p[3], at })
  }
  return out.slice(-MAX_EVENTS)
}
