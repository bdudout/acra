// Version courante de l'application (source : package.json).
import pkg from '../../package.json'

export const APP_VERSION: string = (pkg as { version?: string }).version ?? '0.0.0'

/** Dépôt GitHub de référence pour la vérification de mise à jour (configurable). */
export const GITHUB_REPO: string = process.env.GITHUB_REPO || 'bdudout/acra'
