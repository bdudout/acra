// ─── Rapport annuel de contrôle interne ──────────────────────────────────────
// Structure le rapport annuel (attendu, p. ex. Arrêté du 3 nov. 2014) : une vue
// par LIGNE DE DÉFENSE (1ʳᵉ : opérationnel/contrôle permanent ; 2ᵉ : gestion des
// risques/conformité ; 3ᵉ : audit interne) + un volet résilience opérationnelle
// TIC (DORA), assortie d'une APPRÉCIATION globale du dispositif. Réutilise
// `buildComitePack` pour la sélection/agrégation des indicateurs. PURE et testée.

import { buildComitePack, type ComiteConsolide, type ComiteModules, type ComiteSection, type ComiteHighlight } from './comite-pack'

export const APPRECIATIONS = ['SATISFAISANT', 'A_RENFORCER', 'INSUFFISANT'] as const
export type Appreciation = (typeof APPRECIATIONS)[number]

export type LigneDefense = '1' | '2' | '3' | 'TIC'

export interface RapportLigne {
  ligne: LigneDefense
  sections: ComiteSection[]
}

export interface RapportControleInterne {
  groupes: RapportLigne[]
  highlights: ComiteHighlight[]
  appreciation: Appreciation
  /** Mode « ligne unique » (2ᵉ ligne désactivée) : 1ʳᵉ et 2ᵉ lignes fusionnées. */
  ligneUnique: boolean
}

// Rattachement de chaque domaine à une ligne de défense (modèle des 3 lignes).
const LIGNE_DE: Record<string, LigneDefense> = {
  risques: '1', incidents: '1', controles: '1',
  appetit: '2', kri: '2', regulateur: '2',
  audit: '3',
  dora: 'TIC',
}
const ORDRE_LIGNES: LigneDefense[] = ['1', '2', '3', 'TIC']

export function buildRapportControleInterne(consolide: ComiteConsolide, modules: ComiteModules, opts: { secondeLigneActive?: boolean } = {}): RapportControleInterne {
  // Mode « ligne unique » (org non régulée, 2ᵉ ligne désactivée) : 1ʳᵉ et 2ᵉ lignes
  // fusionnées, et la segmentation N1/N2 (attendu de 2ᵉ ligne) est omise.
  const ligneUnique = opts.secondeLigneActive === false

  // Vue « tous domaines » : le rapport annuel couvre l'ensemble du dispositif.
  const pack = buildComitePack('RISQUES', consolide, modules)

  // Segmentation du contrôle permanent N1 / N2 : si le consolidé fournit le détail
  // par niveau, on enrichit la section « controles » de métriques dédiées
  // (contrôle permanent 1ʳᵉ ligne N1 vs 2ᵉ ligne N2) — attendu du rapport annuel.
  const parN = ligneUnique ? undefined : consolide.controles?.parNiveau
  const sections = parN
    ? pack.sections.map(sec => {
        if (sec.id !== 'controles') return sec
        const extra: ComiteSection['metrics'] = []
        if (parN.N1) {
          if (parN.N1.tauxConformite != null) extra.push({ key: 'tauxConformiteN1', value: parN.N1.tauxConformite })
          extra.push({ key: 'anomaliesN1', value: parN.N1.anomalies, alerte: parN.N1.anomalies > 0 })
        }
        if (parN.N2) {
          if (parN.N2.tauxConformite != null) extra.push({ key: 'tauxConformiteN2', value: parN.N2.tauxConformite })
          extra.push({ key: 'anomaliesN2', value: parN.N2.anomalies, alerte: parN.N2.anomalies > 0 })
        }
        return { ...sec, metrics: [...sec.metrics, ...extra] }
      })
    : pack.sections

  const parLigne = new Map<LigneDefense, ComiteSection[]>()
  for (const sec of sections) {
    let ligne = LIGNE_DE[sec.id] ?? '1'
    // Mode ligne unique : les domaines de 2ᵉ ligne rejoignent la 1ʳᵉ (contrôle interne).
    if (ligneUnique && ligne === '2') ligne = '1'
    const arr = parLigne.get(ligne) ?? []
    arr.push(sec)
    parLigne.set(ligne, arr)
  }
  const groupes: RapportLigne[] = ORDRE_LIGNES
    .filter(l => parLigne.has(l))
    .map(l => ({ ligne: l, sections: parLigne.get(l)! }))

  const alertes = pack.highlights.filter(h => h.niveau === 'alerte').length
  const appreciation: Appreciation = alertes === 0 ? 'SATISFAISANT' : alertes <= 3 ? 'A_RENFORCER' : 'INSUFFISANT'

  return { groupes, highlights: pack.highlights, appreciation, ligneUnique }
}
