// ─── Store partagé multi-instance (limites de débit + verrouillage de compte) ───
// Appelé UNE fois au démarrage par src/instrumentation.ts (runtime Node.js).
//  - Sans REDIS_URL : stores en mémoire (installation mono-instance, défaut inchangé).
//  - Avec REDIS_URL : client Redis sans dépendance (lib/redis-resp.ts), vérifié par PING,
//    puis injecté dans rate-limit.ts ET login-lockout.ts.
//  - Redis injoignable ou URL invalide : ERREUR → l'instance refuse de démarrer.
//    Décision « intégrité avant disponibilité » (docs/specs/scalabilite-haute-disponibilite.md § 5) :
//    retomber en silence sur des compteurs par instance multiplierait par N le seuil anti-force
//    brute et le verrouillage de compte, sans que personne ne le voie.
//    REDIS_OPTIONNEL=1 autorise ce repli EXPLICITEMENT (avertissement au démarrage).
// Après le démarrage, une panne de Redis fait échouer les appels (connexion, écritures limitées)
// au lieu de les laisser passer sans limite : comportement « fermé » assumé (cf. docs/deploiement-haute-disponibilite.md).

import { configureRateLimitStore } from '@/lib/rate-limit'
import { RedisRateLimitStore } from '@/lib/rate-limit-redis'
import { configureLockoutStore, RedisLockoutStore } from '@/lib/login-lockout'
import { createRespClient, parseRedisUrl, type RespClient } from '@/lib/redis-resp'

export type SharedStoreMode = 'memoire' | 'redis' | 'memoire_secours'

export interface SharedStoreDeps {
  createClient?: (url: string) => RespClient
  log?: { info: (m: string) => void; warn: (m: string) => void }
}

/** Hôte:port seuls (jamais d'identifiants) pour les journaux et erreurs. */
function describeUrl(url: string | undefined): string {
  if (!url) return ''
  try { const u = parseRedisUrl(url); return `${u.tls ? 'rediss' : 'redis'}://${u.host}:${u.port}` } catch { return '(URL invalide)' }
}

/** Message de démarrage lisible par l'exploitant (sans secret). */
export function sharedStoreStartupMessage(mode: SharedStoreMode, url?: string): string {
  switch (mode) {
    case 'redis': return `Limites de débit et verrouillage de compte partagés via Redis (${describeUrl(url)}).`
    case 'memoire_secours': return `Redis (${describeUrl(url)}) injoignable et REDIS_OPTIONNEL=1 : limites de débit et verrouillage de compte NON partagés entre instances (mémoire locale).`
    default: return 'Limites de débit et verrouillage de compte en mémoire (mono-instance). Définir REDIS_URL en multi-instance.'
  }
}

/**
 * Configure les stores selon l'environnement. Rend le mode retenu ; lève une erreur si Redis est
 * demandé mais indisponible (sauf REDIS_OPTIONNEL=1).
 */
export async function configureSharedStores(
  env: Record<string, string | undefined> = process.env,
  deps: SharedStoreDeps = {},
): Promise<SharedStoreMode> {
  const log = deps.log ?? console
  const url = env.REDIS_URL?.trim()
  if (!url) {
    configureRateLimitStore(null)
    configureLockoutStore(null)
    return 'memoire'
  }

  let client: RespClient | null = null
  try {
    client = (deps.createClient ?? ((u: string) => createRespClient(u)))(url)
    await client.ping()
  } catch (e) {
    await client?.quit().catch(() => undefined)
    const cause = e instanceof Error && /^redis_url_invalide$/.test(e.message) ? 'URL invalide (attendu redis:// ou rediss://)' : 'injoignable'
    if (env.REDIS_OPTIONNEL === '1') {
      configureRateLimitStore(null)
      configureLockoutStore(null)
      log.warn(sharedStoreStartupMessage('memoire_secours', url))
      return 'memoire_secours'
    }
    // Pas de message brut de la cause (il pourrait contenir l'URL) : seulement son code.
    const code = e instanceof Error ? (e as NodeJS.ErrnoException).code ?? e.message.split(' ')[0] : 'erreur'
    throw new Error(
      `REDIS_URL défini mais ${cause} (${describeUrl(url)} : ${cause === 'injoignable' ? code : 'redis_url_invalide'}). ` +
      'Démarrage refusé pour ne pas utiliser des limites de débit et un verrouillage de compte non partagés entre instances. ' +
      'Corriger REDIS_URL, retirer REDIS_URL (mono-instance) ou définir REDIS_OPTIONNEL=1 pour accepter ce repli.',
    )
  }

  configureRateLimitStore(new RedisRateLimitStore(client))
  configureLockoutStore(new RedisLockoutStore(client))
  log.info(sharedStoreStartupMessage('redis', url))
  return 'redis'
}
