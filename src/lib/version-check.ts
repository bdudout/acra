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

/** Une mise à jour est-elle disponible (latest strictement > current) ? */
export function updateAvailable(current: unknown, latest: unknown): boolean {
  if (!parseSemver(current) || !parseSemver(latest)) return false
  return compareSemver(current, latest) === -1
}
