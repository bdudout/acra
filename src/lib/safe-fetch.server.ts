// ─── Client HTTPS sortant anti-SSRF (couche serveur) ─────────────────────────
// La résolution DNS est faite ET validée dans le `lookup` utilisé par la socket
// elle-même : l'IP contrôlée est celle à laquelle on se connecte (aucune fenêtre
// de rebinding entre « vérifier » et « se connecter »). HTTPS obligatoire, pas de
// redirection suivie, taille de réponse et durée bornées. Audit 2026-09-30 (N02/N03).

import https from 'node:https'
import dns from 'node:dns'
import type { LookupAddress } from 'node:dns'
import { isInternalHostname, isPrivateIp } from '@/lib/ip-safety'

export interface SafeRequestInit {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  maxBytes?: number
}

type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void

/** `lookup` de socket : résout toutes les adresses et refuse si l'une est non publique. */
export function safeLookup(hostname: string, options: dns.LookupOptions, cb: LookupCb): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err)
    const list = addrs as LookupAddress[]
    if (!list.length || list.some(a => isPrivateIp(a.address))) {
      const e: NodeJS.ErrnoException = new Error('url_resout_ip_privee')
      e.code = 'ESSRF'
      return cb(e)
    }
    if (options.all) return cb(null, list)
    cb(null, list[0].address, list[0].family)
  })
}

/** Requête HTTPS vers un hôte public uniquement. Rejette avec `Error('url_non_autorisee' | 'url_resout_ip_privee' | …)`. */
export function safeHttpsRequest(rawUrl: string, init: SafeRequestInit = {}): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    let u: URL
    try { u = new URL(rawUrl) } catch { return reject(new Error('url_non_autorisee')) }
    if (u.protocol !== 'https:' || u.username || u.password || isInternalHostname(u.hostname)) return reject(new Error('url_non_autorisee'))
    const maxBytes = init.maxBytes ?? 1_048_576
    const req = https.request({
      protocol: 'https:', hostname: u.hostname.replace(/^\[|\]$/g, ''), port: u.port || 443,
      path: `${u.pathname}${u.search}`, method: init.method ?? 'GET',
      headers: { ...init.headers, ...(init.body != null ? { 'Content-Length': String(Buffer.byteLength(init.body)) } : {}) },
      lookup: safeLookup as unknown as https.RequestOptions['lookup'],
      timeout: init.timeoutMs ?? 10_000,
    }, res => {
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (c: Buffer) => {
        size += c.length
        if (size > maxBytes) { req.destroy(new Error('response_too_large')); return }
        chunks.push(c)
      })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }))
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    if (init.body != null) req.write(init.body)
    req.end()
  })
}

/** Adaptateur `fetch`-compatible (Response) au-dessus de `safeHttpsRequest`. */
export async function safeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  new Headers(init.headers).forEach((v, k) => { headers[k] = v })
  const r = await safeHttpsRequest(input, {
    method: init.method, headers, body: typeof init.body === 'string' ? init.body : undefined,
  })
  const hdrs = new Headers()
  for (const [k, v] of Object.entries(r.headers)) if (typeof v === 'string') hdrs.set(k, v)
  // Une Response 204/304 ne peut pas porter de corps.
  const nullBody = r.status === 204 || r.status === 205 || r.status === 304
  return new Response(nullBody ? null : new Uint8Array(r.body), { status: r.status, headers: hdrs })
}

/** Résout un hôte et renvoie une IP publique validée (toutes les adresses doivent l'être), sinon lève. */
export function resolvePublicAddress(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    safeLookup(hostname.replace(/^\[|\]$/g, ''), {}, (err, address) => {
      if (err || typeof address !== 'string') reject(err ?? new Error('dns_irresolvable'))
      else resolve(address)
    })
  })
}
