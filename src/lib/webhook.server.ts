// ─── Émission & livraison des webhooks sortants (couche serveur) ─────────────
import { prisma } from '@/lib/prisma'
import { lookup } from 'node:dns/promises'
import {
  webhookSubscribers,
  signWebhookPayload,
  resolveDeliveryUpdate,
  isSafeWebhookUrl,
  isPrivateIp,
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

async function deliverOne(url: string, secret: string, payload: string) {
  // Garde SSRF au moment de l'envoi (l'URL a pu être posée avant durcissement).
  if (!isSafeWebhookUrl(url)) return { ok: false, error: 'url_non_autorisee' }
  // Anti-SSRF renforcé (#132) : `isSafeWebhookUrl` ne voit que le hostname littéral.
  // On RÉSOUT le hostname et on refuse s'il pointe vers une IP privée/interne
  // (hostname public → IP privée). Note : une réattribution DNS active (rebinding)
  // entre cette résolution et le fetch reste théoriquement possible (le fetch
  // re-résout) — l'épinglage de connexion serait le cran au-dessus.
  try {
    const addrs = await lookup(new URL(url).hostname, { all: true })
    if (addrs.some(a => isPrivateIp(a.address))) return { ok: false, error: 'url_resout_ip_privee' }
  } catch {
    return { ok: false, error: 'dns_irresolvable' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [WEBHOOK_SIGNATURE_HEADER]: signWebhookPayload(secret, payload),
        'User-Agent': 'ACRA-Webhook/1',
      },
      body: payload,
      redirect: 'manual', // pas de suivi de redirection (contournement SSRF)
      signal: controller.signal,
    })
    return { ok: res.ok, code: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'erreur_reseau' }
  } finally {
    clearTimeout(timer)
  }
}
