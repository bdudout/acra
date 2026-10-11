// ─── Traductions + vocabulaire de l'organisation, côté serveur ───────────────
// Les exports, e-mails et PDF (hors React) appliquent le même vocabulaire que l'interface :
// `getTOrg(locale, cfg.vocabulaire)` remplace `getT(locale)` là où l'organisation est connue.

import { getT } from '@/lib/i18n'
import { applyVocabulaire, sanitizeVocabulaire } from '@/lib/vocabulaire'

export function getTOrg(locale: string, vocabulaire: unknown) {
  return applyVocabulaire(getT(locale), sanitizeVocabulaire(vocabulaire), locale)
}

/**
 * Pages rendues côté serveur : traductions de la langue courante (cookie) + vocabulaire de l'organisation active, comme
 * l'interface cliente. Sans organisation : traductions livrées.
 */
export async function getServerTOrg(orgId: string | null | undefined) {
  const { getServerLocale } = await import('@/lib/i18n')
  const locale = await getServerLocale()
  if (!orgId) return getT(locale)
  const { getOrgConfig } = await import('@/lib/org-config.server')
  return getTOrg(locale, (await getOrgConfig(orgId)).vocabulaire)
}
