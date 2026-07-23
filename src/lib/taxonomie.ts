/**
 * taxonomie.ts — Taxonomie de risques (socle GRC). Module PUR, testable.
 *
 * Défaut : les 7 catégories d'événements de risque opérationnel de Bâle II/III
 * (cible ACPR), ENTIÈREMENT surchargeables par organisation. Un nœud est référencé
 * par son `code` stable (comme les référentiels/stratégies) plutôt que par une clé
 * étrangère — plus flexible pour un défaut personnalisable et robuste aux éditions.
 *
 * Hiérarchie à 2 niveaux : une catégorie (parent = null) et d'éventuelles
 * sous-catégories (parent = code de la catégorie). M0 livre les 7 niveaux 1.
 */

export type TaxonomieDomaine = 'OP_RISK' | 'CYBER' | 'GENERAL'
export const TAXONOMIE_DOMAINES: TaxonomieDomaine[] = ['OP_RISK', 'CYBER', 'GENERAL']

export interface TaxonomieNode {
  /** Identifiant stable (référencé par les risques). Ex. « BALE_1 » ou un code custom. */
  code: string
  /** Clé i18n du libellé par défaut (nœuds livrés). Ignorée si `label` est fourni. */
  labelKey?: string
  /** Libellé personnalisé (édition par l'organisation). Prime sur `labelKey`. */
  label?: string
  /** Code de la catégorie parente (niveau 2), ou null/absent (niveau 1). */
  parent?: string | null
  domaine: TaxonomieDomaine
  ordre: number
  actif?: boolean
}

/** Les 7 catégories d'événements de Bâle (risque opérationnel). Libellés via i18n. */
export const DEFAULT_TAXONOMIE_BALE: TaxonomieNode[] = [
  { code: 'BALE_1', labelKey: 'taxonomie.bale.1', domaine: 'OP_RISK', ordre: 1, parent: null },
  { code: 'BALE_2', labelKey: 'taxonomie.bale.2', domaine: 'OP_RISK', ordre: 2, parent: null },
  { code: 'BALE_3', labelKey: 'taxonomie.bale.3', domaine: 'OP_RISK', ordre: 3, parent: null },
  { code: 'BALE_4', labelKey: 'taxonomie.bale.4', domaine: 'OP_RISK', ordre: 4, parent: null },
  { code: 'BALE_5', labelKey: 'taxonomie.bale.5', domaine: 'OP_RISK', ordre: 5, parent: null },
  { code: 'BALE_6', labelKey: 'taxonomie.bale.6', domaine: 'OP_RISK', ordre: 6, parent: null },
  { code: 'BALE_7', labelKey: 'taxonomie.bale.7', domaine: 'OP_RISK', ordre: 7, parent: null },
]

const CODE_RE = /^[A-Za-z0-9_-]{1,40}$/

/**
 * Nettoie une taxonomie fournie (édition org) : codes valides et uniques, libellés
 * bornés, domaine connu, parent existant, ordre numérique. Renvoie une liste sûre.
 */
export function sanitizeTaxonomie(input: unknown): TaxonomieNode[] {
  if (!Array.isArray(input)) return []
  const out: TaxonomieNode[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const code = String(o.code ?? '').trim()
    if (!CODE_RE.test(code) || seen.has(code)) continue
    const domaine = TAXONOMIE_DOMAINES.includes(o.domaine as TaxonomieDomaine) ? (o.domaine as TaxonomieDomaine) : 'OP_RISK'
    const node: TaxonomieNode = {
      code,
      domaine,
      ordre: typeof o.ordre === 'number' && Number.isFinite(o.ordre) ? o.ordre : out.length + 1,
      parent: typeof o.parent === 'string' && o.parent.trim() ? o.parent.trim() : null,
      actif: o.actif === false ? false : true,
    }
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, 120) : ''
    if (label) node.label = label
    const labelKey = typeof o.labelKey === 'string' ? o.labelKey.trim().slice(0, 80) : ''
    if (labelKey) node.labelKey = labelKey
    if (!node.label && !node.labelKey) continue // un nœud doit avoir un libellé (custom ou i18n)
    seen.add(code)
    out.push(node)
  }
  // Écarte les parents inexistants (référence orpheline → catégorie de niveau 1).
  const codes = new Set(out.map(n => n.code))
  for (const n of out) if (n.parent && !codes.has(n.parent)) n.parent = null
  return out.sort((a, b) => a.ordre - b.ordre)
}

/** Taxonomie effective : l'override de l'organisation s'il est non vide, sinon le défaut Bâle. */
export function resolveTaxonomie(override: unknown, defaults: TaxonomieNode[] = DEFAULT_TAXONOMIE_BALE): TaxonomieNode[] {
  const clean = sanitizeTaxonomie(override)
  return clean.length > 0 ? clean : defaults
}

/** Libellé d'affichage d'un nœud : personnalisé si présent, sinon résolu via i18n. */
export function taxonomieLabel(node: TaxonomieNode, tr: (key: string) => string): string {
  if (node.label) return node.label
  if (node.labelKey) { const v = tr(node.labelKey); return v || node.code }
  return node.code
}
