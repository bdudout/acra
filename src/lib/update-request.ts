// ─── Mise à jour d'une instance auto-hébergée depuis l'interface (#185) — PUR ─
// L'application ne lance JAMAIS de commande système : elle dépose une demande
// (canal stable ou bêta, rien d'autre) dans `.acra-update/inbox/`, qu'un agent
// hôte (`scripts/update-agent.sh`, planifié par cron) exécute via `scripts/update.sh`.
// L'agent publie sa pulsation (`agent.json`) et l'avancement (`status.json`).

import { isUpdateChannel, type UpdateChannel } from '@/lib/version-check'

/** Au-delà de ce délai sans pulsation, l'agent est considéré absent. */
export const AGENT_MAX_AGE_MS = 5 * 60 * 1000

export interface UpdateRequest { id: string; channel: UpdateChannel; requestedBy: string; requestedAt: string }
export type UpdateState = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
export interface UpdateStatus { state: UpdateState; channel?: UpdateChannel; version?: string; message?: string; at?: string }

/** Demande de mise à jour : canal validé + traçabilité. Lève si le canal est inconnu. */
export function buildUpdateRequest(a: { channel: UpdateChannel; userId: string; now: Date; id: string }): UpdateRequest {
  if (!isUpdateChannel(a.channel)) throw new Error('invalid_channel')
  return { id: a.id, channel: a.channel, requestedBy: a.userId, requestedAt: a.now.toISOString() }
}

/** L'agent hôte a-t-il publié une pulsation récente ? */
export function agentAlive(heartbeat: unknown, now: Date, maxAgeMs = AGENT_MAX_AGE_MS): boolean {
  const at = heartbeat && typeof heartbeat === 'object' ? Date.parse(String((heartbeat as { at?: unknown }).at)) : NaN
  return Number.isFinite(at) && now.getTime() - at <= maxAgeMs && at <= now.getTime() + 60_000
}

const STATES: readonly UpdateState[] = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']
const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined)

/** Statut publié par l'agent, assaini (champs connus, textes bornés) ; invalide → null. */
export function parseUpdateStatus(raw: unknown): UpdateStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!STATES.includes(o.state as UpdateState)) return null
  const out: UpdateStatus = { state: o.state as UpdateState }
  if (isUpdateChannel(o.channel)) out.channel = o.channel
  const version = str(o.version, 40); if (version) out.version = version
  const message = str(o.message, 500); if (message) out.message = message
  const at = str(o.at, 40); if (at) out.at = at
  return out
}
