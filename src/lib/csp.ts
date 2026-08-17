/**
 * csp.ts — Construction de la Content-Security-Policy (issue #108).
 *
 * En PRODUCTION, `script-src` utilise un nonce + `strict-dynamic` (plus de
 * `'unsafe-inline'` sur les scripts) : seuls les scripts portant le nonce (ceux de
 * Next et le script de thème) et ceux qu'ils chargent sont autorisés. En DEV, on
 * conserve `'unsafe-inline'` + `'unsafe-eval'` (HMR et fonctions de debug de React
 * en mode développement, qui utilisent `eval()` — jamais en production).
 *
 * `style-src` garde `'unsafe-inline'` (CSS-in-JS / styles inline de Next) — le
 * durcissement porte sur les scripts, vecteur XSS principal.
 */
export function buildCsp(nonce: string | undefined, isProd: boolean): string {
  const scriptSrc = isProd && nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : isProd
      // Prod sans nonce (repli défensif) : strict, sans unsafe-eval.
      ? "script-src 'self' 'unsafe-inline'"
      // Dev : React a besoin d'`eval()` pour ses fonctions de debug + HMR.
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
}
