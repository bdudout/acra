/**
 * conformite.ts — Analyse de conformité au socle de sécurité (optionnelle).
 *
 * Fonctionnalité activable (OrganizationConfig.conformiteActive) inspirée de la
 * fiche méthode du Club EBIOS « Comment exploiter les non-conformités du socle
 * de sécurité dans une analyse EBIOS RM ». En atelier 1, l'utilisateur évalue la
 * conformité de chaque contrôle du référentiel choisi ; les NON-CONFORMITÉS
 * (statut non_conforme ou partiel) alimentent un « catalogue de vulnérabilités »
 * réutilisé en ateliers 3/4, avec garde-fou « tunnel de conformité » en atelier 5.
 *
 * Module pur (pas de React, pas de DB, pas de libellés) ; les libellés des statuts
 * viennent de l'i18n (t.conformite.statuts.*). Testé dans
 * src/__tests__/unit/lib/conformite.test.ts.
 */

export type ConformiteStatut = 'conforme' | 'partiel' | 'non_conforme' | 'na'

export const CONFORMITE_STATUTS: ConformiteStatut[] = ['conforme', 'partiel', 'non_conforme', 'na']

/** Évaluation de conformité d'un contrôle du référentiel (clé = ref du contrôle). */
export interface ConformiteEntry {
  ref: string
  statut: ConformiteStatut
  commentaire?: string
  /** DÉRIVÉ (jamais stocké) : contrôle non-conforme couvert par une dérogation active. */
  derogee?: boolean
}

const isStatut = (s: unknown): s is ConformiteStatut =>
  typeof s === 'string' && (CONFORMITE_STATUTS as string[]).includes(s)

/**
 * Filtre des évaluations : ne conserve que les entrées valides (ref non vide,
 * statut connu), commentaire borné. Si `validRefs` est fourni, ne garde que les
 * contrôles existants du référentiel.
 */
export function sanitizeConformite(entries: unknown, validRefs?: Set<string>): ConformiteEntry[] {
  if (!Array.isArray(entries)) return []
  const out: ConformiteEntry[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue
    const ref = String((e as any).ref ?? '').trim()
    const statut = (e as any).statut
    if (!ref || !isStatut(statut)) continue
    if (validRefs && !validRefs.has(ref)) continue
    if (seen.has(ref)) continue
    seen.add(ref)
    const entry: ConformiteEntry = { ref, statut }
    const c = (e as any).commentaire
    if (typeof c === 'string' && c.trim()) entry.commentaire = c.trim().slice(0, 1000)
    out.push(entry)
  }
  return out
}

/**
 * Marque « dérogé » (dérivé, non stocké) les contrôles non-conforme/partiel dont
 * la `ref` figure dans l'ensemble des contrôles couverts par une dérogation ACTIVE.
 * Un contrôle conforme/NA n'est jamais dérogé (décision : non-conforme ET dérogé).
 * Pur → testable.
 */
export function marquerDerogations(entries: ConformiteEntry[], derogRefs: Set<string>): ConformiteEntry[] {
  if (!derogRefs || derogRefs.size === 0) return entries
  return entries.map(e =>
    (e.statut === 'non_conforme' || e.statut === 'partiel') && derogRefs.has(e.ref)
      ? { ...e, derogee: true }
      : e,
  )
}

/**
 * Non-conformités exploitables : contrôles non_conforme/partiel NON dérogés.
 * Ce sont elles qui alimentent le catalogue de vulnérabilités (ateliers 3/4) ; un
 * contrôle dérogé en sort (il y ré-entre automatiquement à l'expiration, car la
 * marque `derogee` disparaît quand la dérogation n'est plus active).
 */
export function deriveNonConformites(entries: ConformiteEntry[]): ConformiteEntry[] {
  return entries.filter(e => (e.statut === 'non_conforme' || e.statut === 'partiel') && !e.derogee)
}

export interface ConformiteStats {
  conforme: number
  partiel: number
  nonConforme: number
  na: number
  /** Contrôles non-conformes couverts par une dérogation active (bucket dédié). */
  deroge: number
  /** Nombre de contrôles évalués (toutes valeurs confondues). */
  evalues: number
  /** Nombre total de contrôles du référentiel. */
  total: number
  /** Taux de conformité = conforme / (évalués hors NA), en % entier. */
  tauxConformite: number
}

/**
 * Applique un nouveau statut à un contrôle (par `ref`) dans une liste d'évaluations :
 * met à jour l'entrée existante (en préservant le commentaire) ou l'ajoute si absente.
 * Retourne une nouvelle liste (immutable). Utilisé par l'édition inline du socle
 * depuis le dashboard. Pur, testé.
 */
export function applyConformiteStatut(
  entries: ConformiteEntry[],
  ref: string,
  statut: ConformiteStatut,
): ConformiteEntry[] {
  const r = String(ref ?? '').trim()
  if (!r || !isStatut(statut)) return entries
  let found = false
  const out = entries.map(e => {
    if (e.ref !== r) return e
    found = true
    return { ...e, statut }
  })
  if (!found) out.push({ ref: r, statut })
  return out
}

/** Conformité effective d'une analyse (propre, ou héritée du socle) — Palier 1. */
export interface EffectiveConformite {
  entries: ConformiteEntry[]
  /** Vrai si les entrées proviennent du socle (analyse fille sans conformité propre). */
  inherited: boolean
  sourceAnalyseId: string | null
  sourceAnalyseNom: string | null
}

/**
 * Résout la conformité effective d'une analyse (Palier 1) :
 *  - si l'analyse a sa PROPRE conformité (entries non vides) → on la garde ;
 *  - sinon, si elle hérite d'un socle qui en a une → on affiche celle du socle
 *    (héritée, en LECTURE) ;
 *  - sinon → vide.
 * Résolution à la lecture (aucune copie/migration). Pur, testé.
 */
export function resolveEffectiveConformite(params: {
  ownEntries: ConformiteEntry[]
  socle?: { id: string; nom: string; entries: ConformiteEntry[] } | null
}): EffectiveConformite {
  const own = params.ownEntries ?? []
  if (own.length > 0) {
    return { entries: own, inherited: false, sourceAnalyseId: null, sourceAnalyseNom: null }
  }
  const socle = params.socle
  if (socle && (socle.entries?.length ?? 0) > 0) {
    return { entries: socle.entries, inherited: true, sourceAnalyseId: socle.id, sourceAnalyseNom: socle.nom }
  }
  return { entries: [], inherited: false, sourceAnalyseId: null, sourceAnalyseNom: null }
}

export function conformiteStats(entries: ConformiteEntry[], total: number): ConformiteStats {
  let conforme = 0, partiel = 0, nonConforme = 0, na = 0, deroge = 0
  for (const e of entries) {
    // Un contrôle dérogé bascule dans son propre bucket (retiré de conforme/partiel/non-conforme).
    if (e.derogee) { deroge++; continue }
    if (e.statut === 'conforme') conforme++
    else if (e.statut === 'partiel') partiel++
    else if (e.statut === 'non_conforme') nonConforme++
    else if (e.statut === 'na') na++
  }
  // Le dérogé reste au dénominateur (c'est une non-conformité assumée temporairement) : le
  // taux de conformité ne « gonfle » pas artificiellement.
  const pertinents = conforme + partiel + nonConforme + deroge
  const tauxConformite = pertinents > 0 ? Math.round((conforme / pertinents) * 100) : 0
  return { conforme, partiel, nonConforme, na, deroge, evalues: entries.length, total, tauxConformite }
}
