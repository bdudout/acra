import { withAuth } from 'next-auth/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath } from '@/lib/public-paths'
import { buildCsp } from '@/lib/csp'

export default withAuth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function middleware(req: NextRequest & { nextauth?: { token?: any } }) {
    const { pathname } = req.nextUrl
    const token = req.nextauth?.token

    // CSP par requête (issue #108) : en prod, script-src à nonce + strict-dynamic
    // (plus d'`unsafe-inline` sur les scripts) ; en dev, CSP inchangée.
    const isProd = process.env.NODE_ENV === 'production'
    const nonce = isProd ? btoa(crypto.randomUUID()) : undefined
    const csp = buildCsp(nonce, isProd)

    // #10/#11 — changement de mot de passe obligatoire : rediriger tant que ce
    // n'est pas fait. On laisse passer la page de changement, l'API de changement,
    // les routes d'auth (déconnexion) et les pages légales.
    if (token?.mustChangePassword) {
      const allowed =
        pathname.startsWith('/auth/change-password') ||
        pathname.startsWith('/api/user/password') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/legal')
      if (!allowed) {
        const url = req.nextUrl.clone()
        url.pathname = '/auth/change-password'
        url.search = ''
        const redirect = NextResponse.redirect(url)
        redirect.headers.set('Content-Security-Policy', csp)
        return redirect
      }
    }

    // Nonce transmis à Next via l'en-tête de requête (Next l'applique à ses scripts)
    // + en-tête `x-nonce` lisible par le layout pour le script de thème inline.
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('Content-Security-Policy', csp)
    if (nonce) requestHeaders.set('x-nonce', nonce)
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('Content-Security-Policy', csp)
    return res
  },
  {
    callbacks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorized: ({ token, req }: { token: any; req: any }) => {
        const { pathname } = req.nextUrl
        // Pages publiques (dont /api/health, sondé par le healthcheck)
        if (isPublicPath(pathname)) return true
        return !!token
      },
    },
  }
)

export const config = {
  // Exclut les internes Next ET les fichiers statiques servis depuis /public
  // (servis à la racine, ex. /logo-mark.png) : sans l'exclusion par extension, le
  // middleware redirigeait ces requêtes vers /auth/signin → images cassées.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
