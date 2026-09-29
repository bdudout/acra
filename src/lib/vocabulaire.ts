/**
 * vocabulaire.ts — Vocabulaire personnalisable par organisation (lot L5). Module PUR.
 *
 * Renomme des TERMES à l'AFFICHAGE (menu, titres) sans toucher aux clés techniques : chaque terme
 * pointe vers les chemins i18n qu'il remplace. Un libellé peut être général (`*`) ou propre à une
 * langue ; à défaut, le libellé livré est conservé. Les 5 langues restent complètes.
 */

export const VOCAB_TERMS = {
  incident: ['nav.incidents', 'incidents.title'],
  controle: ['nav.controles', 'controles.title'],
  audit: ['nav.audit', 'auditInterne.title'],
  kri: ['nav.kri', 'kri.title'],
  projet: ['nav.projets', 'projets.title'],
  derogation: ['nav.derogations', 'derogations.title'],
  rapports: ['nav.rapports', 'rapports.title'],
} as const satisfies Record<string, readonly string[]>
export type VocabTerm = keyof typeof VOCAB_TERMS

export const VOCAB_LOCALES = ['fr', 'en', 'de', 'es', 'it'] as const
export type Vocabulaire = Partial<Record<VocabTerm, Record<string, string>>>
const MAX_LABEL = 60

/** Nettoie la configuration stockée : termes et langues connus, libellés non vides et bornés. */
export function sanitizeVocabulaire(input: unknown): Vocabulaire {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: Vocabulaire = {}
  for (const term of Object.keys(VOCAB_TERMS) as VocabTerm[]) {
    const raw = (input as Record<string, unknown>)[term]
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const labels: Record<string, string> = {}
    for (const k of ['*', ...VOCAB_LOCALES]) {
      const v = (raw as Record<string, unknown>)[k]
      if (typeof v === 'string' && v.trim()) labels[k] = v.trim().slice(0, MAX_LABEL)
    }
    if (Object.keys(labels).length) out[term] = labels
  }
  return out
}

/**
 * Applique le vocabulaire à un objet de traductions (sans le muter : seuls les chemins touchés sont
 * copiés). Vocabulaire vide → le même objet.
 */
export function applyVocabulaire<T extends object>(t: T, vocab: Vocabulaire, locale: string): T {
  const entries = (Object.entries(vocab) as [VocabTerm, Record<string, string>][])
    .map(([term, labels]) => [term, labels[locale] ?? labels['*']] as const).filter(([, l]) => !!l)
  if (entries.length === 0) return t
  const root = { ...t } as Record<string, unknown>
  for (const [term, label] of entries) {
    for (const path of VOCAB_TERMS[term]) {
      const parts = path.split('.')
      let cur = root
      for (let i = 0; i < parts.length - 1; i++) {
        const next = cur[parts[i]]
        if (!next || typeof next !== 'object') { cur = {}; break }
        cur[parts[i]] = { ...(next as object) }
        cur = cur[parts[i]] as Record<string, unknown>
      }
      const last = parts[parts.length - 1]
      if (typeof cur[last] === 'string') cur[last] = label
    }
  }
  return root as T
}
