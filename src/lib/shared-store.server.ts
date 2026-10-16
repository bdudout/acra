// ─── Store partagé multi-instance (limites de débit + verrouillage de compte) ───
// Appelé UNE fois au démarrage par src/instrumentation.ts (runtime Node.js).
//  - Ni REDIS_URL ni REDIS_SENTINELS : stores en mémoire (mono-instance, défaut inchangé).
//  - REDIS_URL (Redis unique ou managé, point d'entrée fixe) OU REDIS_SENTINELS + REDIS_SENTINEL_MASTER
//    (Redis Sentinel auto-hébergé) — exclusifs : client sans dépendance (lib/redis-resp.ts), vérifié
//    par PING, puis injecté dans rate-limit.ts ET login-lockout.ts.
//  - Configuration incohérente (URL invalide, les deux modes, délai invalide…) : ERREUR → refus de
//    démarrer, toujours (REDIS_OPTIONNEL ne couvre pas une erreur de configuration).
//  - Redis injoignable : ERREUR → l'instance refuse de démarrer.
//    Décision « intégrité avant disponibilité » (docs/specs/scalabilite-haute-disponibilite.md § 5) :
//    retomber en silence sur des compteurs par instance multiplierait par N le seuil anti-force
//    brute et le verrouillage de compte, sans que personne ne le voie.
//    REDIS_OPTIONNEL=1 autorise ce repli EXPLICITEMENT (avertissement au démarrage).
// Après le démarrage, une panne de Redis fait échouer les appels (connexion, écritures limitées)
// au lieu de les laisser passer sans limite : comportement « fermé » assumé, BORNÉ par
// REDIS_TIMEOUT_MS (défaut 2 000 ms) ; le client se reconnecte seul après une bascule
// (cf. docs/deploiement-haute-disponibilite.md § Redis).

import { configureRateLimitStore } from '@/lib/rate-limit'
import { RedisRateLimitStore } from '@/lib/rate-limit-redis'
import { configureLockoutStore, RedisLockoutStore } from '@/lib/login-lockout'
import {
  configFromUrl, createRespClient, parseSentinelList,
  type RedisClientConfig, type RespClient, type RespClientOptions,
} from '@/lib/redis-resp'

export type SharedStoreMode = 'memoire' | 'redis' | 'memoire_secours'

export interface SharedStoreDeps {
  createClient?: (config: RedisClientConfig, options: RespClientOptions) => RespClient
  log?: { info: (m: string) => void; warn: (m: string) => void }
}

const DEFAULT_TIMEOUT_MS = 2_000

/**
 * Lit la configuration Redis de l'environnement. `null` : aucun Redis demandé (mémoire).
 * Lève une erreur lisible (sans secret) si la configuration est incohérente.
 */
export function redisConfigFromEnv(
  env: Record<string, string | undefined>,
): { config: RedisClientConfig; options: RespClientOptions } | null {
  const val = (k: string) => { const v = env[k]?.trim(); return v ? v : undefined }
  const url = val('REDIS_URL')
  const sentinels = val('REDIS_SENTINELS')
  if (!url && !sentinels) return null
  if (url && sentinels) {
    throw new Error('REDIS_URL et REDIS_SENTINELS sont exclusifs : définir REDIS_URL (Redis unique ou managé) OU REDIS_SENTINELS + REDIS_SENTINEL_MASTER (Redis Sentinel), pas les deux.')
  }

  const rawTimeout = val('REDIS_TIMEOUT_MS')
  const timeout = rawTimeout === undefined ? DEFAULT_TIMEOUT_MS : Number(rawTimeout)
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60_000) {
    throw new Error('REDIS_TIMEOUT_MS invalide : entier en millisecondes entre 100 et 60000 (défaut 2000).')
  }
  const options: RespClientOptions = { connectTimeoutMs: timeout, commandTimeoutMs: timeout }
  const password = val('REDIS_PASSWORD')
  const username = val('REDIS_USERNAME')

  if (url) {
    let config: RedisClientConfig
    try { config = configFromUrl(url) } catch {
      throw new Error(`REDIS_URL défini mais URL invalide (redis_url_invalide : attendu redis:// ou rediss://).`)
    }
    // Défini aux deux endroits : accepté seulement si identique (ex. profil « ha » qui construit l'URL
    // à partir de REDIS_PASSWORD) ; sinon, on ne devine pas lequel est le bon.
    if (password && config.password && password !== config.password) throw new Error('Mot de passe Redis contradictoire : REDIS_URL et REDIS_PASSWORD diffèrent ; n\'en définir qu\'un.')
    if (username && config.username && username !== config.username) throw new Error('Utilisateur Redis contradictoire : REDIS_URL et REDIS_USERNAME diffèrent ; n\'en définir qu\'un.')
    return { config: { ...config, password: config.password ?? password, username: config.username ?? username }, options }
  }

  const masterName = val('REDIS_SENTINEL_MASTER')
  if (!masterName) throw new Error('REDIS_SENTINELS défini sans REDIS_SENTINEL_MASTER (nom du primaire surveillé par les sentinelles, ex. « acra »).')
  let list
  try { list = parseSentinelList(sentinels!) } catch {
    throw new Error('REDIS_SENTINELS invalide : liste hôte[:port] séparée par des virgules (ex. redis1:26379,redis2:26379,redis3:26379).')
  }
  return {
    config: {
      sentinel: { sentinels: list, masterName, password: val('REDIS_SENTINEL_PASSWORD') },
      tls: val('REDIS_TLS') === '1',
      username, password, db: undefined,
    },
    options,
  }
}

/** Point(s) d'entrée seuls (jamais d'identifiants) pour les journaux et erreurs. */
function describeConfig(config: RedisClientConfig): string {
  if (config.sentinel) {
    return `Sentinel ${config.sentinel.sentinels.map(s => `${s.host.includes(':') ? `[${s.host}]` : s.host}:${s.port}`).join(',')}, primaire « ${config.sentinel.masterName} »${config.tls ? ', TLS' : ''}`
  }
  const ep = config.endpoint!
  return `${config.tls ? 'rediss' : 'redis'}://${ep.host.includes(':') ? `[${ep.host}]` : ep.host}:${ep.port}`
}

function describeTarget(target: RedisClientConfig | string | undefined): string {
  if (!target) return ''
  if (typeof target !== 'string') return describeConfig(target)
  try { return describeConfig(configFromUrl(target)) } catch { return '(URL invalide)' }
}

/** Message de démarrage lisible par l'exploitant (sans secret). */
export function sharedStoreStartupMessage(mode: SharedStoreMode, target?: RedisClientConfig | string): string {
  switch (mode) {
    case 'redis': return `Limites de débit et verrouillage de compte partagés via Redis (${describeTarget(target)}).`
    case 'memoire_secours': return `Redis (${describeTarget(target)}) injoignable et REDIS_OPTIONNEL=1 : limites de débit et verrouillage de compte NON partagés entre instances (mémoire locale).`
    default: return 'Limites de débit et verrouillage de compte en mémoire (mono-instance). Définir REDIS_URL ou REDIS_SENTINELS en multi-instance.'
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
  const parsed = redisConfigFromEnv(env) // erreur de configuration → refus de démarrer
  if (!parsed) {
    configureRateLimitStore(null)
    configureLockoutStore(null)
    return 'memoire'
  }
  const { config, options } = parsed
  const varName = config.sentinel ? 'REDIS_SENTINELS' : 'REDIS_URL'

  let client: RespClient | null = null
  try {
    client = (deps.createClient ?? createRespClient)(config, options)
    await client.ping()
  } catch (e) {
    await client?.quit().catch(() => undefined)
    if (env.REDIS_OPTIONNEL === '1') {
      configureRateLimitStore(null)
      configureLockoutStore(null)
      log.warn(sharedStoreStartupMessage('memoire_secours', config))
      return 'memoire_secours'
    }
    // Pas de message brut de la cause (il pourrait contenir un secret) : seulement son code.
    const code = e instanceof Error ? (e as NodeJS.ErrnoException).code ?? e.message.split(' ')[0] : 'erreur'
    throw new Error(
      `${varName} défini mais Redis injoignable (${describeConfig(config)} : ${code}). ` +
      'Démarrage refusé pour ne pas utiliser des limites de débit et un verrouillage de compte non partagés entre instances. ' +
      `Corriger ${varName}, le retirer (mono-instance) ou définir REDIS_OPTIONNEL=1 pour accepter ce repli.`,
    )
  }

  configureRateLimitStore(new RedisRateLimitStore(client))
  configureLockoutStore(new RedisLockoutStore(client))
  log.info(sharedStoreStartupMessage('redis', config))
  return 'redis'
}
