/** Identité embarquée dans l'image ; ne dépend pas du lancement via npm. */
export function releaseInfo(env: Record<string, string | undefined>): { version: string; revision: string } {
  return { version: env.ACRA_VERSION || 'development', revision: env.ACRA_REVISION || 'unknown' }
}
