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
 * Non-conformités exploitables : contrôles évalués non_conforme ou partiel.
 * Ce sont elles qui alimentent le catalogue de vulnérabilités (ateliers 3/4).
 */
export function deriveNonConformites(entries: ConformiteEntry[]): ConformiteEntry[] {
  return entries.filter(e => e.statut === 'non_conforme' || e.statut === 'partiel')
}

export interface ConformiteStats {
  conforme: number
  partiel: number
  nonConforme: number
  na: number
  /** Nombre de contrôles évalués (toutes valeurs confondues). */
  evalues: number
  /** Nombre total de contrôles du référentiel. */
  total: number
  /** Taux de conformité = conforme / (évalués hors NA), en % entier. */
  tauxConformite: number
}

export function conformiteStats(entries: ConformiteEntry[], total: number): ConformiteStats {
  let conforme = 0, partiel = 0, nonConforme = 0, na = 0
  for (const e of entries) {
    if (e.statut === 'conforme') conforme++
    else if (e.statut === 'partiel') partiel++
    else if (e.statut === 'non_conforme') nonConforme++
    else if (e.statut === 'na') na++
  }
  const pertinents = conforme + partiel + nonConforme
  const tauxConformite = pertinents > 0 ? Math.round((conforme / pertinents) * 100) : 0
  return { conforme, partiel, nonConforme, na, evalues: entries.length, total, tauxConformite }
}
