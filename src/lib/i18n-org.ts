// ─── Traductions + vocabulaire de l'organisation, côté serveur ───────────────
// Les exports, e-mails et PDF (hors React) appliquent le même vocabulaire que l'interface :
// `getTOrg(locale, cfg.vocabulaire)` remplace `getT(locale)` là où l'organisation est connue.

import { getT } from '@/lib/i18n'
import { applyVocabulaire, sanitizeVocabulaire } from '@/lib/vocabulaire'

export function getTOrg(locale: string, vocabulaire: unknown) {
  return applyVocabulaire(getT(locale), sanitizeVocabulaire(vocabulaire), locale)
}
