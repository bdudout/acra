// ─── Lecture d'un connecteur d'entités (REST ou LDAP) ─────────────────────────
// Partagée par la synchronisation historique (responsables de mesures, arbre des organisations) et l'import vers le
// référentiel des entités (lot E2). Secrets déchiffrés côté serveur seulement ; requêtes vers des adresses publiques.
import { decryptSecret } from './secret-crypto'
import { fetchLdapEntities, fetchRestEntities, type EntitySyncConfig } from './entity-sync'
import { safeFetch, resolvePublicAddress } from './safe-fetch.server'

export function configConnecteur(value: unknown): EntitySyncConfig { return value && typeof value === 'object' ? value as EntitySyncConfig : {} }

export function connecteurConfigure(cfg: EntitySyncConfig): boolean {
  return (cfg.type === 'REST' && !!cfg.endpoint) || (cfg.type === 'LDAP' && !!cfg.endpoint && !!cfg.bindDN && !!cfg.baseDN)
}

export async function lireConnecteur(cfg: EntitySyncConfig): Promise<string[]> {
  if (cfg.type === 'REST' && cfg.endpoint) return fetchRestEntities(cfg.endpoint, decryptSecret(cfg.token) ?? null, safeFetch)
  if (cfg.type === 'LDAP' && cfg.endpoint && cfg.bindDN && cfg.baseDN) {
    const password = decryptSecret(cfg.password)
    if (!password) throw new Error('connector_secret_unavailable')
    return fetchLdapEntities({ url: cfg.endpoint, bindDN: cfg.bindDN, password, baseDN: cfg.baseDN, filter: cfg.filter, resolveHost: resolvePublicAddress })
  }
  throw new Error('connector_not_configured')
}
