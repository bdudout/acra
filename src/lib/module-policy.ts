/**
 * module-policy.ts — Politique d'ACTIVATION des modules à 3 niveaux (socle GRC).
 *
 * Modèle de configuration général du projet : un toggle PAR ORGANISATION
 * (OrganizationConfig) surplombé par une POLITIQUE D'INSTANCE (Configuration,
 * SUPER_ADMIN) à 3 états :
 *  - PER_ORG   : chaque organisation décide (défaut, rétrocompatible) ;
 *  - FORCE_ON  : actif partout, les organisations ne peuvent pas désactiver ;
 *  - FORCE_OFF : indisponible partout, aucune organisation ne peut activer.
 *
 * La valeur EFFECTIVE est résolue en un seul point (getOrgConfig) → tout le code
 * qui lit `orgConfig.<module>Active` obtient déjà la valeur forcée. Module PUR.
 */

export type ModulePolicy = 'PER_ORG' | 'FORCE_ON' | 'FORCE_OFF'
export const MODULE_POLICIES: ModulePolicy[] = ['PER_ORG', 'FORCE_ON', 'FORCE_OFF']

/** Modules dont l'activation peut être gouvernée au niveau instance (extensible). */
export const GOVERNABLE_MODULES = ['registreRisques', 'incidents', 'controlePermanent'] as const
export type GovernableModule = typeof GOVERNABLE_MODULES[number]

/** Valeur effective d'activation d'un module : la politique d'instance prime. */
export function resolveModuleActivation(policy: ModulePolicy | null | undefined, orgValue: boolean): boolean {
  if (policy === 'FORCE_ON') return true
  if (policy === 'FORCE_OFF') return false
  return orgValue // PER_ORG ou absent → l'organisation décide
}

/** Vrai si la politique verrouille le toggle de l'organisation (imposé/interdit). */
export function isModuleForced(policy: ModulePolicy | null | undefined): boolean {
  return policy === 'FORCE_ON' || policy === 'FORCE_OFF'
}

/** Nettoie la carte de politiques d'instance : ne garde que les modules connus et les états valides. */
export function sanitizeModulesPolicy(input: unknown): Partial<Record<GovernableModule, ModulePolicy>> {
  const out: Partial<Record<GovernableModule, ModulePolicy>> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  const obj = input as Record<string, unknown>
  for (const m of GOVERNABLE_MODULES) {
    const v = obj[m]
    if (v === 'FORCE_ON' || v === 'FORCE_OFF' || v === 'PER_ORG') out[m] = v
  }
  return out
}
