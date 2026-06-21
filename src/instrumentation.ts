/**
 * Next.js Instrumentation Hook — exécuté une seule fois au démarrage du serveur.
 * Référence : https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runStartupChecks } = await import('./lib/startup-checks')
    runStartupChecks()
    // Amorçage multi-organisation : garantir au moins un super-administrateur.
    const { ensureSuperAdmin } = await import('./lib/org-bootstrap')
    await ensureSuperAdmin()
  }
}
