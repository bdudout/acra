/**
 * Next.js Instrumentation Hook — exécuté une seule fois au démarrage du serveur.
 * Référence : https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runStartupChecks } = await import('./lib/startup-checks')
    runStartupChecks()
    // Multi-instance : limites de débit et verrouillage de compte partagés si REDIS_URL est défini.
    // Redis demandé mais indisponible → arrêt (intégrité avant disponibilité ; repli : REDIS_OPTIONNEL=1).
    const { configureSharedStores } = await import('./lib/shared-store.server')
    try {
      await configureSharedStores()
      // DOCUMENT_STORAGE=s3 : configuration validée dès le démarrage (variable manquante → arrêt),
      // plutôt qu'au premier téléversement. Aucun appel réseau ici.
      if ((process.env.DOCUMENT_STORAGE ?? '').toLowerCase() === 's3') {
        const { getDocumentStorage } = await import('./lib/document-storage')
        await getDocumentStorage()
      }
    } catch (e) {
      console.error(`\x1b[31m✗ [ACRA-STARTUP]\x1b[0m ${(e as Error).message}`)
      process.exit(1)
    }
    // Amorçage multi-organisation : garantir au moins un super-administrateur.
    const { ensureSuperAdmin } = await import('./lib/org-bootstrap')
    await ensureSuperAdmin()
    // Journal d'audit des événements de cycle de vie de l'instance (mise à jour, retour arrière, restauration).
    const { recordInstanceEvents } = await import('./lib/instance-events.server')
    void recordInstanceEvents()
  }
}
