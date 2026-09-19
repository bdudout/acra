import { validatePassword, DEFAULT_POLICY } from './password-policy'

/** Préconditions explicites d'un jeu de présentation ; aucun compte d'instance. */
export function resolveDemoSeedPasswords(env: Record<string, string | undefined>): Record<'ANALYSTE' | 'RSSI' | 'DIRECTION_METIER', string> {
  if (env.ACRA_DEMO_MODE !== 'true' || env.ACRA_SEED_CONFIRM !== 'DEMO_ONLY') {
    throw new Error('Le seed exige ACRA_DEMO_MODE=true et ACRA_SEED_CONFIRM=DEMO_ONLY sur une base dédiée.')
  }
  const passwords = {
    ANALYSTE: env.ACRA_SEED_ANALYSTE_PASSWORD ?? '',
    RSSI: env.ACRA_SEED_RSSI_PASSWORD ?? '',
    DIRECTION_METIER: env.ACRA_SEED_DIRECTION_PASSWORD ?? '',
  }
  if (Object.values(passwords).some(p => p.length < 16 || validatePassword(p, DEFAULT_POLICY).length > 0)
      || new Set(Object.values(passwords)).size !== 3) {
    throw new Error('Trois secrets distincts respectant la politique et de 16 caractères minimum sont requis.')
  }
  return passwords
}
