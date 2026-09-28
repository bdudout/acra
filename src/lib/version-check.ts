// ─── Vérification de mise à jour (notify-only) ───────────────────────────────
// Compare la version de l'application à la dernière release publiée sur GitHub,
// et signale si une mise à jour est disponible — SANS installer (l'installation
// reste un déploiement manuel/CI). Logique de comparaison PURE et testée.

/** Parse un tag semver (« v1.2.3 », « 1.0.0-rc.1 ») en [major, minor, patch]. */
export function parseSemver(v: unknown): [number, number, number] | null {
  if (typeof v !== 'string') return null
  const m = v.trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!m) return null
  return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)]
}

/** Compare deux versions semver : -1 (a<b), 0 (=), 1 (a>b). Invalide → 0. */
export function compareSemver(a: unknown, b: unknown): -1 | 0 | 1 {
  const pa = parseSemver(a), pb = parseSemver(b)
  if (!pa || !pb) return 0
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1
    if (pa[i] > pb[i]) return 1
  }
  return 0
}

/** Identifiants de préversion (« 1.0.4-beta.2 » → ['beta', '2']) ; [] pour une version finale. */
function prerelease(v: unknown): string[] {
  if (typeof v !== 'string') return []
  const m = v.trim().replace(/^v/i, '').match(/^\d+(?:\.\d+){0,2}-([0-9A-Za-z.-]+)/)
  return m ? m[1].split('.') : []
}

/**
 * Comparaison SemVer complète (§11) : cœur X.Y.Z puis préversion — une préversion
 * PRÉCÈDE la version finale (1.0.4-beta.1 < 1.0.4), identifiants numériques
 * comparés numériquement. Invalide → 0.
 */
export function compareVersions(a: unknown, b: unknown): -1 | 0 | 1 {
  const core = compareSemver(a, b)
  if (core !== 0 || !parseSemver(a) || !parseSemver(b)) return core
  const pa = prerelease(a), pb = prerelease(b)
  if (!pa.length && !pb.length) return 0
  if (!pa.length) return 1
  if (!pb.length) return -1
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1
    if (pb[i] === undefined) return 1
    const na = /^\d+$/.test(pa[i]), nb = /^\d+$/.test(pb[i])
    if (na && nb) { const d = Number(pa[i]) - Number(pb[i]); if (d) return d < 0 ? -1 : 1; continue }
    if (na !== nb) return na ? -1 : 1
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}

/** Une mise à jour est-elle disponible (latest strictement > current, préversions comprises) ? */
export function updateAvailable(current: unknown, latest: unknown): boolean {
  if (!parseSemver(current) || !parseSemver(latest)) return false
  return compareVersions(current, latest) === -1
}

// ─── Canaux de mise à jour (#185) ────────────────────────────────────────────
// stable = branche `stable`, alignée sur la dernière release stable publiée ;
// beta   = branche `main` : dernière version validée + évolutions suivantes, avec
//          une version de préversion (ex. 1.0.4-beta.1) dans package.json.

export const UPDATE_CHANNELS = ['stable', 'beta'] as const
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number]

/** Garde de saisie : seuls les deux canaux connus sont acceptés (aucune autre valeur). */
export function isUpdateChannel(v: unknown): v is UpdateChannel {
  return typeof v === 'string' && (UPDATE_CHANNELS as readonly string[]).includes(v)
}

/**
 * État de version d'une instance face à la dernière release stable :
 * canal (préversion ⇒ bêta), mise à jour disponible, et pour une bêta en avance,
 * la version validée sur laquelle elle se base.
 */
export function describeVersion(current: unknown, latestStable: unknown): { channel: UpdateChannel; updateAvailable: boolean; base: string | null } {
  const channel: UpdateChannel = prerelease(current).length ? 'beta' : 'stable'
  const upd = updateAvailable(current, latestStable)
  const base = channel === 'beta' && typeof latestStable === 'string' && parseSemver(latestStable) && compareVersions(latestStable, current) < 0 ? latestStable : null
  return { channel, updateAvailable: upd, base }
}

/** Le serveur ne déclenche que la dernière release, et jamais une régression. */
export function canDispatchReleaseDeployment(current: unknown, latest: unknown, requested: unknown): boolean {
  // Les tags GitHub ont souvent un préfixe « v », alors que la version applicative
  // n'en a pas : l'autorisation porte sur la version SemVer, pas sur sa mise en forme.
  if (!parseSemver(latest) || !parseSemver(requested)) return false
  return compareVersions(latest, requested) === 0 && updateAvailable(current, requested)
}
