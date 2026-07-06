/**
 * uid.ts — Génération d'identifiants d'éléments côté client.
 *
 * Usage NON cryptographique : clés React et ids d'items dans les tableaux JSON des
 * ateliers (audit R05 / CWE-330). Préfère `crypto.randomUUID()` / `getRandomValues`
 * quand disponibles (uniformité avec `crypto.randomUUID()` déjà adopté pour l'import,
 * #109), avec repli `Math.random()` pour les contextes non sécurisés (HTTP non-TLS
 * hors localhost, où l'API Web Crypto peut être indisponible).
 */
export function uid(): string {
  try {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
      if (typeof crypto.getRandomValues === 'function') {
        const a = new Uint32Array(2)
        crypto.getRandomValues(a)
        return a[0].toString(36) + a[1].toString(36)
      }
    }
  } catch {
    // Web Crypto indisponible (contexte non sécurisé) → repli ci-dessous.
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
