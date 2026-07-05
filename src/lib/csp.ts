/**
 * csp.ts — Construction de la Content-Security-Policy (issue #108).
 *
 * En PRODUCTION, `script-src` utilise un nonce + `strict-dynamic` (plus de
 * `'unsafe-inline'` sur les scripts) : seuls les scripts portant le nonce (ceux de
 * Next et le script de thème) et ceux qu'ils chargent sont autorisés. En DEV, on
 * conserve `'unsafe-inline'` (comportement inchangé, HMR non impacté).
 *
 * `style-src` garde `'unsafe-inline'` (CSS-in-JS / styles inline de Next) — le
 * durcissement porte sur les scripts, vecteur XSS principal.
 */
export function buildCsp(nonce: string | undefined, isProd: boolean): string {
  const scriptSrc = isProd && nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "script-src 'self' 'unsafe-inline'"
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
