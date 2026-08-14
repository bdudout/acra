// ─── Socle GRC — M1 Cartographie ─────────────────────────────────────────────
// Agrège les risques du registre canonique (RiskItem) en une cartographie :
//   • une heat map gravité × vraisemblance (position de chaque risque) ;
//   • une ventilation par dimension de la maille (taxonomie / processus / entité).
// Logique PURE et testable — l'UI ne fait que rendre le modèle produit ici.

// Le registre cote sur 1-5 (cf. cleanRiskItem/clamp). La cartographie partage les
// MÊMES seuils que les pastilles du tableau (produit G×V) → cohérence visuelle.
export const CARTO_MAX = 5

export type CartoMode = 'inherent' | 'residual'
export type CartoDimension = 'taxonomie' | 'processus' | 'entite'
export type NiveauBucket = 'faible' | 'moyen' | 'eleve'

export interface CartoRisk {
  id: string
  intitule: string
  taxonomieCode: string | null
  processusId: string | null
  processusNom: string | null
  entite: string | null
  graviteInherente: number | null
  vraisemblanceInherente: number | null
  graviteResiduelle: number | null
  vraisemblanceResiduelle: number | null
}

// Couple (gravité, vraisemblance) selon le mode ; null si la cotation est incomplète.
// En mode RÉSIDUEL, si le couple résiduel est incomplet, on ancre le risque sur son
// couple INHÉRENT complet (miroir du repli `niveauResiduel ?? niveauInherent` de
// riskNiveauBucket/postureBucket) : un risque identifié mais non traité reste placé
// sur la carte à son exposition inhérente au lieu d'être compté « non coté » — la
// heat map, les filtres, le pilotage et l'export s'accordent alors (source unique, #123).
export function coupleFor(r: CartoRisk, mode: CartoMode): { g: number; v: number } | null {
  if (mode === 'residual' && r.graviteResiduelle != null && r.vraisemblanceResiduelle != null) {
    return { g: r.graviteResiduelle, v: r.vraisemblanceResiduelle }
  }
  // Inhérent : mode inhérent, OU résiduel incomplet (repli d'ancrage).
  if (r.graviteInherente == null || r.vraisemblanceInherente == null) return null
  return { g: r.graviteInherente, v: r.vraisemblanceInherente }
}

// Palier de niveau (produit G×V) — aligné sur les pastilles du registre.
export function niveauBucket(niveau: number): NiveauBucket {
  if (niveau >= 12) return 'eleve'
  if (niveau >= 6) return 'moyen'
  return 'faible'
}

export interface HeatCell {
  gravite: number
  vraisemblance: number
  niveau: number
  bucket: NiveauBucket
  risqueIds: string[]
}
export interface Heatmap {
  cells: HeatCell[] // uniquement les cellules non vides, triées g asc puis v asc
  totalCote: number
  totalNonCote: number
  parBucket: Record<NiveauBucket, number>
}

// Place chaque risque coté dans sa cellule (gravité × vraisemblance).
export function buildHeatmap(risks: CartoRisk[], mode: CartoMode): Heatmap {
  const map = new Map<string, HeatCell>()
  let totalCote = 0
  let totalNonCote = 0
  const parBucket: Record<NiveauBucket, number> = { faible: 0, moyen: 0, eleve: 0 }

  for (const r of risks) {
    const c = coupleFor(r, mode)
    if (!c) { totalNonCote++; continue }
    totalCote++
    const key = `${c.g}:${c.v}`
    let cell = map.get(key)
    if (!cell) {
      const niveau = c.g * c.v
      cell = { gravite: c.g, vraisemblance: c.v, niveau, bucket: niveauBucket(niveau), risqueIds: [] }
      map.set(key, cell)
    }
    cell.risqueIds.push(r.id)
    parBucket[cell.bucket]++
  }

  const cells = [...map.values()].sort((a, b) => a.gravite - b.gravite || a.vraisemblance - b.vraisemblance)
  return { cells, totalCote, totalNonCote, parBucket }
}

export interface CartoBucket {
  key: string // code taxonomie / id processus / libellé entité ; '' = non renseigné
  label: string | null // libellé lisible connu (processusNom) sinon null → résolu par l'UI
  count: number
  cote: number // risques cotés dans le mode courant
  maxNiveau: number | null // niveau max (produit) parmi les risques cotés
  pireBucket: NiveauBucket | null
  risqueIds: string[]
}

// Ventile les risques selon une dimension de la maille, triés du plus critique
// (maxNiveau décroissant) au moins critique ; le bucket « non renseigné » (key '')
// est toujours renvoyé en dernier.
export function aggregateByDimension(risks: CartoRisk[], dimension: CartoDimension, mode: CartoMode): CartoBucket[] {
  const map = new Map<string, CartoBucket>()

  for (const r of risks) {
    const key = dimension === 'taxonomie' ? (r.taxonomieCode ?? '')
      : dimension === 'processus' ? (r.processusId ?? '')
      : (r.entite ?? '')
    const label = dimension === 'processus' ? (r.processusNom ?? null)
      : dimension === 'entite' ? (r.entite || null)
      : null
    let b = map.get(key)
    if (!b) { b = { key, label, count: 0, cote: 0, maxNiveau: null, pireBucket: null, risqueIds: [] }; map.set(key, b) }
    b.count++
    b.risqueIds.push(r.id)
    const c = coupleFor(r, mode)
    if (c) {
      b.cote++
      const niveau = c.g * c.v
      if (b.maxNiveau == null || niveau > b.maxNiveau) { b.maxNiveau = niveau; b.pireBucket = niveauBucket(niveau) }
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.key === '' && b.key !== '') return 1
    if (b.key === '' && a.key !== '') return -1
    return (b.maxNiveau ?? -1) - (a.maxNiveau ?? -1) || b.count - a.count
  })
}
