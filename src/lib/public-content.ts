/**
 * public-content.ts — Contenu public configurable de l'instance (bandeau démo,
 * appel à l'action de contact/déploiement), résolu depuis la configuration
 * d'instance avec repli sur les défauts (libellés i18n fournis par l'appelant).
 * Même patron que `branding.ts` : module pur → testable ; le helper serveur
 * lit la config, l'endpoint public `/api/demo/status` renvoie les surcharges
 * brutes et le client applique le repli avec ses libellés i18n.
 *
 * Objectif produit : un déployeur d'instance publique personnalise le message
 * d'accueil et le lien de contact SANS toucher aux fichiers i18n ni aux vars
 * d'environnement (cf. « partie publique configurable par l'utilisateur »).
 */

export interface PublicContent {
  /** Texte du bandeau public (rappel RGPD / message d'accueil). */
  notice: string
  /** Destination de l'appel à l'action (URL http(s), mailto: ou chemin relatif). */
  contactUrl: string
  /** Libellé de l'appel à l'action. */
  contactLabel: string
}

export interface PublicContentConfig {
  publicNotice?: string | null
  publicContactUrl?: string | null
  publicContactLabel?: string | null
}

/**
 * Une URL de destination est sûre si elle est relative (`/…`) ou porte un schéma
 * inoffensif (http/https/mailto). Tout autre schéma (`javascript:`, `data:`, …)
 * est rejeté pour éviter une injection via l'attribut `href` rendu côté public,
 * même si seul un SUPER_ADMIN peut définir la valeur (défense en profondeur).
 */
function safeUrl(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (v.startsWith('/')) return v
  if (/^(https?:|mailto:)/i.test(v)) return v
  return null
}

/**
 * Contenu public effectif : surcharge de configuration si renseignée (non vide
 * et, pour l'URL, sûre), sinon défaut fourni par l'appelant (libellés i18n).
 */
export function resolvePublicContent(
  cfg: PublicContentConfig | null | undefined,
  defaults: PublicContent,
): PublicContent {
  const url = cfg?.publicContactUrl ? safeUrl(cfg.publicContactUrl) : null
  return {
    notice: cfg?.publicNotice?.trim() || defaults.notice,
    contactUrl: url || defaults.contactUrl,
    contactLabel: cfg?.publicContactLabel?.trim() || defaults.contactLabel,
  }
}
