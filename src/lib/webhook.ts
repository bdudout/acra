// ─── Webhooks sortants (notifications d'événements vers des SI tiers) ─────────
// Logique PURE et testable : vocabulaire d'événements, signature HMAC, sélection
// des abonnés, politique de ré-essai (backoff), garde SSRF sur l'URL cible.
// La persistance et l'émission HTTP vivent dans les couches serveur/cron.

import { createHmac } from 'crypto'
import { isInternalHostname, isPrivateIp } from '@/lib/ip-safety'

/** Vocabulaire canonique des événements émis (org-scopés). */
export const WEBHOOK_EVENTS = [
  'risk.created',
  'risk.updated',
  'incident.declared',
  'incident.updated',
  'control.executed',
  'control.anomaly',
  'analyse.approved',
] as const

/** Événement auquel un webhook peut souscrire (création/modification d'objets GRC…). */
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

const EVENT_SET = new Set<string>(WEBHOOK_EVENTS)

/**
 * Nettoie une liste d'événements d'abonnement : ne garde que les événements
 * connus, dédupliqués et ordonnés selon WEBHOOK_EVENTS. `'*'` = tous.
 */
export function cleanWebhookEvents(input: unknown): WebhookEvent[] {
  if (!Array.isArray(input)) return []
  if (input.includes('*')) return [...WEBHOOK_EVENTS]
  const seen = new Set<string>()
  for (const e of input) if (typeof e === 'string' && EVENT_SET.has(e)) seen.add(e)
  return WEBHOOK_EVENTS.filter(e => seen.has(e))
}

/** Signature HMAC-SHA256 (hex) d'un corps de requête avec le secret du webhook. */
export function signWebhookPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

/** En-tête portant la signature (convention type Stripe/GitHub). */
export const WEBHOOK_SIGNATURE_HEADER = 'X-ACRA-Signature'

interface SubscribableHook { actif: boolean; events: string[] }

/** Abonnés actifs pour un événement donné (un webhook abonné à `'*'` reçoit tout). */
export function webhookSubscribers<T extends SubscribableHook>(hooks: T[], event: string): T[] {
  return hooks.filter(h => h.actif && (h.events.includes('*') || h.events.includes(event)))
}

export const WEBHOOK_MAX_ATTEMPTS = 6

/**
 * Délai avant la prochaine tentative (ms). Backoff exponentiel base 30 s,
 * plafonné à 6 h. `attempt` = numéro de la tentative déjà effectuée (≥1).
 */
export function nextBackoffDelayMs(attempt: number): number {
  const base = 30_000 // 30 s
  const cap = 6 * 60 * 60 * 1000 // 6 h
  const a = Math.max(1, Math.floor(attempt))
  const delay = base * Math.pow(2, a - 1)
  return Math.min(delay, cap)
}

/** Résultat d'une tentative de livraison d'un webhook (succès + code HTTP / erreur). */
export interface DeliveryResult { ok: boolean; code?: number; error?: string }
/** Mise à jour de l'état de livraison d'un webhook (statut + prochaine tentative). */
export interface DeliveryUpdate {
  statut: 'LIVRE' | 'EN_ATTENTE' | 'ECHEC'
  tentatives: number
  prochaineTentativeDelayMs: number
  dernierCode: number | null
  derniereErreur: string | null
}

/**
 * Décide l'état d'une livraison après une tentative. Pur : le cron applique
 * `prochaineTentativeDelayMs` à `now`. Succès → LIVRE. Échec avant le plafond →
 * EN_ATTENTE avec backoff. Échec au plafond → ECHEC (abandon).
 */
export function resolveDeliveryUpdate(tentativesAvant: number, result: DeliveryResult): DeliveryUpdate {
  const tentatives = tentativesAvant + 1
  const dernierCode = result.code ?? null
  if (result.ok) {
    return { statut: 'LIVRE', tentatives, prochaineTentativeDelayMs: 0, dernierCode, derniereErreur: null }
  }
  const derniereErreur = (result.error ?? `HTTP ${result.code ?? '?'}`).slice(0, 500)
  if (tentatives >= WEBHOOK_MAX_ATTEMPTS) {
    return { statut: 'ECHEC', tentatives, prochaineTentativeDelayMs: 0, dernierCode, derniereErreur }
  }
  return { statut: 'EN_ATTENTE', tentatives, prochaineTentativeDelayMs: nextBackoffDelayMs(tentatives), dernierCode, derniereErreur }
}

// Garde SSRF ──────────────────────────────────────────────────────────────────
// Une URL de webhook est réglée par un ADMIN d'org : sans garde, elle permettrait
// de faire émettre le serveur vers des adresses internes (pivot / metadata cloud).
// Validation STATIQUE ici (https, pas d'identifiants, hôte non interne, IP littérale
// publique) ; à l'envoi, `safeHttpsRequest` (safe-fetch.server.ts) résout et valide
// l'IP DANS la socket (aucune fenêtre de rebinding). Logique d'adresse : ip-safety.ts.

export { isPrivateIp }

/** Valide qu'une URL de webhook est sûre (https, pas d'identifiants, hôte public) — anti-SSRF. */
export function isSafeWebhookUrl(raw: unknown): boolean {
  if (typeof raw !== 'string' || raw.trim() === '') return false
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || u.username || u.password) return false
  return !isInternalHostname(u.hostname)
}
