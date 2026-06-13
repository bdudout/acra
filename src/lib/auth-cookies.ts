/**
 * Configuration du cookie de session NextAuth.
 *
 * 🔴 Point critique d'authentification — le nom et le flag `secure` du cookie
 * DOIVENT être identiques côté `authOptions` (qui ÉCRIT le cookie au login et le
 * LIT via `getServerSession`) et côté middleware (`withAuth` → `getToken`, qui le
 * LIT pour autoriser l'accès aux pages protégées).
 *
 * `getToken` (next-auth/jwt) calcule son défaut à partir du SCHÉMA de l'URL
 * publique, et non de `NODE_ENV` :
 *
 *   secureCookie = NEXTAUTH_URL?.startsWith('https://') ?? !!process.env.VERCEL
 *   cookieName   = secureCookie ? '__Secure-next-auth.session-token'
 *                               : 'next-auth.session-token'
 *
 * Le middleware ne reçoit aucune option `cookies`, il utilise donc CE défaut.
 * On reproduit ici exactement la même logique pour `authOptions`, afin que les
 * deux lecteurs restent toujours alignés — y compris en production servie en
 * http (déploiement local/interne), où baser la sécurité sur `NODE_ENV`
 * produirait `__Secure-...` côté login mais `next-auth.session-token` côté
 * middleware, rendant les pages protégées inaccessibles.
 */

export interface SessionCookieConfig {
  /** Nom du cookie de session (avec préfixe `__Secure-` si sécurisé). */
  name: string
  /** Flag `secure` (cookie transmis uniquement sur HTTPS). */
  secure: boolean
}

const SECURE_NAME = '__Secure-next-auth.session-token'
const PLAIN_NAME = 'next-auth.session-token'

/**
 * Détermine le nom et la sécurité du cookie de session, en parité stricte avec
 * le défaut de `getToken` utilisé par le middleware.
 *
 * @param nextAuthUrl Valeur de `NEXTAUTH_URL` (défaut : variable d'environnement).
 * @param isVercel    `true` si déployé sur Vercel (défaut : présence de `VERCEL`).
 */
export function resolveSessionCookie(
  nextAuthUrl: string | undefined = process.env.NEXTAUTH_URL,
  isVercel: boolean = !!process.env.VERCEL,
): SessionCookieConfig {
  // `?.startsWith` renvoie un booléen si l'URL est définie, `undefined` sinon —
  // ce qui déclenche le repli `?? isVercel`, exactement comme dans getToken.
  const useSecureCookies = nextAuthUrl?.startsWith('https://') ?? isVercel
  return {
    name: useSecureCookies ? SECURE_NAME : PLAIN_NAME,
    secure: useSecureCookies,
  }
}
