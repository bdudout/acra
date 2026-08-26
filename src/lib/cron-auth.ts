// ─── Authentification des endpoints cron (planificateur externe) ─────────────
// Convention UNIQUE partagée par toutes les routes /api/cron/* : le secret
// d'infrastructure (CRON_SECRET) est présenté par l'en-tête
// `Authorization: Bearer <CRON_SECRET>` — JAMAIS en query-string (le secret ne
// doit pas transiter dans l'URL : journalisé par le proxy/les logs/Referer,
// CWE-598). Comparaison à temps constant (CWE-208). Fail-closed.

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/** Comparaison à temps constant du jeton présenté et du secret (longueurs égales requises). */
export function cronSecretMatches(token: string, secret: string): boolean {
  const a = Buffer.from(token, 'utf8')
  const b = Buffer.from(secret, 'utf8')
  if (a.length === 0 || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Garde d'authentification d'un appel cron. Retourne une NextResponse d'erreur
 * (503 si CRON_SECRET absent, 401 sinon), ou `null` si l'appel est autorisé.
 * N'accepte que l'en-tête Authorization (pas de fallback query-string).
 */
export function assertCronAuth(req: { headers: { get(name: string): string | null } }): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron désactivé (CRON_SECRET absent)' }, { status: 503 })
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!cronSecretMatches(token, secret)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  return null
}
