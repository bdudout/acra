/**
 * branding.ts — Identité de l'application (nom + baseline), résolue à partir de
 * la configuration d'instance avec repli sur les défauts (i18n). Le nom n'est
 * JAMAIS codé en dur (cf. docs/ara-grc-spec.md §3) : quand des modules non-cyber
 * seront activés, le nouveau nom de gamme se règlera dans la configuration.
 * Module pur → testable ; le helper serveur `branding.server.ts` lit la config.
 */

export interface Branding {
  /** Nom affiché (ex. « ACRA » par défaut). */
  nom: string
  /** Sous-titre / baseline (ex. « Augmented Cyber Risk Analysis »). */
  baseline: string
}

export interface BrandingConfig {
  appName?: string | null
  appBaseline?: string | null
}

/**
 * Nom/baseline effectifs : valeur de configuration si renseignée (non vide),
 * sinon défaut (fourni par l'appelant, typiquement les libellés i18n).
 */
export function resolveBranding(cfg: BrandingConfig | null | undefined, defaults: Branding): Branding {
  return {
    nom: cfg?.appName?.trim() || defaults.nom,
    baseline: cfg?.appBaseline?.trim() || defaults.baseline,
  }
}
