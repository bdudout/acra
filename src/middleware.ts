import { withAuth } from 'next-auth/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath } from '@/lib/public-paths'

export default withAuth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function middleware(req: NextRequest & { nextauth?: { token?: any } }) {
    const { pathname } = req.nextUrl
    const token = req.nextauth?.token

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
        return NextResponse.redirect(url)
      }
    }
    return NextResponse.next()
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
