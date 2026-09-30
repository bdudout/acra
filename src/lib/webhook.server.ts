// ─── Émission & livraison des webhooks sortants (couche serveur) ─────────────
import { prisma } from '@/lib/prisma'
import { safeHttpsRequest } from '@/lib/safe-fetch.server'
import {
  webhookSubscribers,
  signWebhookPayload,
  resolveDeliveryUpdate,
  isSafeWebhookUrl,
  WEBHOOK_SIGNATURE_HEADER,
  type WebhookEvent,
} from '@/lib/webhook'

/**
 * Enfile une livraison de `event` pour chaque webhook actif de l'org qui y est
 * abonné. **Best-effort** : n'interrompt jamais le flux appelant (toute erreur
 * est avalée). Le corps est sérialisé une fois et signé tel quel à l'envoi.
 */
export async function emitWebhookEvent(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const hooks = await prisma.webhook.findMany({ where: { organizationId, actif: true } })
    const abonnes = webhookSubscribers(
      hooks.map(h => ({ ...h, events: Array.isArray(h.events) ? (h.events as string[]) : [] })),
      event,
    )
    if (abonnes.length === 0) return
    const payload = JSON.stringify({ event, organizationId, data, emittedAt: new Date().toISOString() })
    await prisma.webhookDelivery.createMany({
      data: abonnes.map(h => ({ webhookId: h.id, event, payload })),
    })
  } catch {
    // Émission best-effort : ne jamais casser l'action métier.
  }
}

/**
 * Variante GROUPÉE : émet le MÊME `event` pour plusieurs `dataItems` en une seule
 * lecture des abonnés + un seul `createMany` (au lieu d'un aller-retour par item,
 * ex. import en masse). Best-effort — n'interrompt jamais l'appelant.
 */
export async function emitWebhookEvents(
  organizationId: string,
  event: WebhookEvent,
  dataItems: Record<string, unknown>[],
): Promise<void> {
  if (dataItems.length === 0) return
  try {
    const hooks = await prisma.webhook.findMany({ where: { organizationId, actif: true } })
    const abonnes = webhookSubscribers(
      hooks.map(h => ({ ...h, events: Array.isArray(h.events) ? (h.events as string[]) : [] })),
      event,
    )
    if (abonnes.length === 0) return
    const emittedAt = new Date().toISOString()
    const rows = dataItems.flatMap(data => {
      const payload = JSON.stringify({ event, organizationId, data, emittedAt })
      return abonnes.map(h => ({ webhookId: h.id, event, payload }))
    })
    await prisma.webhookDelivery.createMany({ data: rows })
  } catch {
    // Émission best-effort : ne jamais casser l'action métier.
  }
}

const DELIVERY_TIMEOUT_MS = 10_000

/**
 * Traite un lot de livraisons dues (statut EN_ATTENTE, prochaineTentative ≤ now).
 * POST signé vers l'URL du webhook, puis met à jour l'état via la logique pure
 * `resolveDeliveryUpdate`. Retourne un petit résumé pour le cron.
 */
export async function dispatchDueWebhooks(limit = 50): Promise<{ traitees: number; livrees: number; echecs: number }> {
  const due = await prisma.webhookDelivery.findMany({
    where: { statut: 'EN_ATTENTE', prochaineTentative: { lte: new Date() } },
    orderBy: { prochaineTentative: 'asc' },
    take: limit,
    include: { webhook: true },
  })
  let livrees = 0
  let echecs = 0
  for (const d of due) {
    const result = await deliverOne(d.webhook.url, d.webhook.secret, d.payload)
    const u = resolveDeliveryUpdate(d.tentatives, result)
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: {
        statut: u.statut,
        tentatives: u.tentatives,
        prochaineTentative: new Date(Date.now() + u.prochaineTentativeDelayMs),
        dernierCode: u.dernierCode,
        derniereErreur: u.derniereErreur,
      },
    })
    if (u.statut === 'LIVRE') livrees++
    else if (u.statut === 'ECHEC') echecs++
  }
  return { traitees: due.length, livrees, echecs }
}

async function deliverOne(url: string, secret: string, payload: string): Promise<{ ok: boolean; code?: number; error?: string }> {
  // Garde SSRF statique, puis requête dont la résolution DNS est validée dans la
  // socket elle-même (pas de rebinding possible) ; aucune redirection suivie.
  if (!isSafeWebhookUrl(url)) return { ok: false, error: 'url_non_autorisee' }
  try {
    const res = await safeHttpsRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [WEBHOOK_SIGNATURE_HEADER]: signWebhookPayload(secret, payload),
        'User-Agent': 'ACRA-Webhook/1',
      },
      body: payload,
      timeoutMs: DELIVERY_TIMEOUT_MS,
      maxBytes: 65_536,
    })
    return { ok: res.status >= 200 && res.status < 300, code: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'erreur_reseau' }
  }
}
