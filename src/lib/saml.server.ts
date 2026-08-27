// ─── SSO SAML — couche serveur (MODE MAINTENANCE) ────────────────────────────
// Le SSO SAML est développé mais **inerte** : il n'est jamais actif tant que
//   (1) le flag d'instance SSO_SAML_ENABLED n'est pas mis à 'true', ET
//   (2) la vérification cryptographique de l'assertion (dépendance @node-saml)
//       n'est pas câblée et validée avec un IdP réel.
// Tant que l'une manque, l'ACS renvoie 503 « en maintenance » et aucun bouton
// SAML n'est proposé. Aucun impact sur OIDC ni sur le login Credentials.

import { prisma } from '@/lib/prisma'
import { validateSamlConfig } from '@/lib/saml'

/**
 * Mode maintenance SAML. INERTE par défaut : n'est levé que si l'exploitant met
 * explicitement SSO_SAML_ENABLED='true' (et que le câblage @node-saml existe).
 */
export function isSamlMaintenanceMode(): boolean {
  return process.env.SSO_SAML_ENABLED !== 'true'
}

/**
 * SAML réellement actif ? Faux tant qu'on est en maintenance, ou que la config
 * SSOConfig n'est pas activée / de protocole SAML / complète et valide.
 * Best-effort : toute erreur ⇒ inactif.
 */
export async function samlActive(): Promise<boolean> {
  if (isSamlMaintenanceMode()) return false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = await (prisma as any).sSOConfig.findUnique({ where: { id: 'global' } })
    if (!c || c.enabled !== true || c.protocol !== 'SAML') return false
    return validateSamlConfig(c) === null
  } catch {
    return false
  }
}
