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
}

// Rattachement de chaque domaine à une ligne de défense (modèle des 3 lignes).
const LIGNE_DE: Record<string, LigneDefense> = {
  risques: '1', incidents: '1', controles: '1',
  appetit: '2', kri: '2', regulateur: '2',
  audit: '3',
  dora: 'TIC',
}
const ORDRE_LIGNES: LigneDefense[] = ['1', '2', '3', 'TIC']

export function buildRapportControleInterne(consolide: ComiteConsolide, modules: ComiteModules): RapportControleInterne {
  // Vue « tous domaines » : le rapport annuel couvre l'ensemble du dispositif.
  const pack = buildComitePack('RISQUES', consolide, modules)

  const parLigne = new Map<LigneDefense, ComiteSection[]>()
  for (const sec of pack.sections) {
    const ligne = LIGNE_DE[sec.id] ?? '1'
    const arr = parLigne.get(ligne) ?? []
    arr.push(sec)
    parLigne.set(ligne, arr)
  }
  const groupes: RapportLigne[] = ORDRE_LIGNES
    .filter(l => parLigne.has(l))
    .map(l => ({ ligne: l, sections: parLigne.get(l)! }))

  const alertes = pack.highlights.filter(h => h.niveau === 'alerte').length
  const appreciation: Appreciation = alertes === 0 ? 'SATISFAISANT' : alertes <= 3 ? 'A_RENFORCER' : 'INSUFFISANT'

  return { groupes, highlights: pack.highlights, appreciation }
}
