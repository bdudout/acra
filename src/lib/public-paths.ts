/**
 * Détermine si un chemin est accessible SANS authentification.
 *
 * Centralise la liste des routes publiques utilisée par le middleware
 * (`authorized`). En particulier, `/api/health` doit rester public : c'est le
 * endpoint sondé par le healthcheck Docker / les orchestrateurs ; le placer
 * derrière l'auth provoque une redirection 307 et un conteneur « unhealthy ».
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/auth') ||
    pathname === '/' ||
    pathname.startsWith('/api/auth') ||
    // Endpoint de santé — exact (avec slash final optionnel) pour ne pas exposer
    // par erreur une route du type /api/health-internal.
    pathname === '/api/health' ||
    pathname === '/api/health/' ||
    pathname.startsWith('/legal')
  )
}
