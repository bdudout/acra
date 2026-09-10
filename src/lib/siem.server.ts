// ─── Transfert SIEM — accès serveur (config + livraison) ─────────────────────
// Lit la config SIEM (singleton, mémoïsée), décide via la lib pure `siem.ts` et
// livre l'événement au SIEM externe (POST JSON) et/ou sur stdout structuré.
// Appelé par `auditLog` (lib/logger) en best-effort : ne bloque ni ne fait
// jamais échouer la requête. L'endpoint est réglé par un SUPER_ADMIN (de
// confiance) : pas de blocage d'IP privée ici — un SIEM est souvent interne
// (Splunk HEC localhost:8088, Elastic interne…).

import { logger, type AuditAction } from './logger'
import { decryptSecret } from './secret-crypto'
import {
  shouldForward, buildSiemEvent, cleanSiemCategories, type SiemEventCtx, type SiemConfigLite,
} from './siem'

interface SiemConfigRow extends SiemConfigLite {
  endpoint: string | null
  authHeader: string | null
  includeStdout: boolean
}

const DELIVERY_TIMEOUT_MS = 4000
const CACHE_TTL_MS = 10_000
let cached: { at: number; cfg: SiemConfigRow | null } | null = null

/** Invalide le cache (après mise à jour de la config). */
export function invalidateSiemCache(): void { cached = null }

async function readConfig(): Promise<SiemConfigRow | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.cfg
  try {
    const { prisma } = await import('./prisma')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (prisma as any).siemConfig.findUnique({ where: { id: 'global' } })
    const cfg: SiemConfigRow | null = row
      ? {
          enabled: !!row.enabled,
          endpoint: row.endpoint ?? null,
          authHeader: row.authHeader ?? null,
          categories: cleanSiemCategories(row.categories),
          includeStdout: row.includeStdout !== false,
        }
      : null
    cached = { at: Date.now(), cfg }
    return cfg
  } catch {
    return null
  }
}

/** Livraison HTTP d'un événement au SIEM (best-effort). Renvoie ok + code/erreur. */
export async function deliverSiemEvent(
  endpoint: string,
  authHeader: string | null,
  event: unknown,
): Promise<{ ok: boolean; code?: number; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ACRA-SIEM/1',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(event),
      redirect: 'manual',
      signal: controller.signal,
    })
    return { ok: res.ok, code: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'erreur_reseau' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Transfère un événement d'audit au SIEM si le journal correspondant est activé.
 * Best-effort : jamais d'exception propagée à l'appelant.
 */
export async function forwardToSiem(action: AuditAction, ctx: SiemEventCtx): Promise<void> {
  try {
    const cfg = await readConfig()
    if (!cfg) return
    if (!shouldForward(cfg, action)) return
    const event = buildSiemEvent(action, ctx)

    // (1) Émission JSON structuré sur stdout (log-shipper Filebeat/Fluentd).
    if (cfg.includeStdout) logger.info(`SIEM:${event.category}:${action}`, { siem: true, ...event })

    // (2) Livraison HTTP au SIEM externe.
    const res = await deliverSiemEvent(cfg.endpoint!, decryptSecret(cfg.authHeader) ?? null, event)
    // Trace best-effort du dernier résultat (ne bloque pas).
    try {
      const { prisma } = await import('./prisma')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).siemConfig.update({
        where: { id: 'global' },
        data: { lastDeliveryOk: res.ok, lastDeliveryAt: new Date(), lastError: res.ok ? null : (res.error ?? `HTTP ${res.code}`) },
      })
      invalidateSiemCache()
    } catch { /* trace best-effort */ }
  } catch {
    /* le transfert SIEM ne doit jamais casser une requête */
  }
}
