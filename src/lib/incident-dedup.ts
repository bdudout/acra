// ─── Détection de doublons d'incidents ───────────────────────────────────────
// Qualité des données de perte (Bâle, « Principles for the Sound Management of
// Operational Risk » ; ISO/IEC 27035) : UN événement = UN enregistrement. Avant
// qualification par la 2ᵉ ligne (risk manager), on repère les signalements
// probablement identiques (même événement déclaré plusieurs fois) pour proposer
// un rattachement / rejet en doublon. Logique PURE, sans DB — consommée à la
// déclaration (avertissement) et dans la file « à qualifier ».

/** Forme minimale d'un incident pour le rapprochement. */
export interface IncidentDedupItem {
  id: string
  intitule: string
  statut: string
  dateSurvenance?: Date | string | null
  dateDetection?: Date | string | null
  processusId?: string | null
  entite?: string | null
  taxonomieCode?: string | null
}

export interface DuplicateMatch {
  id: string
  intitule: string
  statut: string
  score: number // 0..1
}

export interface DedupOptions {
  fenetreJours?: number // fenêtre de proximité des dates (défaut 14 j)
  seuil?: number // score minimal pour signaler un doublon (défaut 0.5)
}

const STOPWORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'sur', 'pour', 'aux', 'par', 'en', 'au', 'a', 'the', 'of', 'to', 'in'])

/** Tokens significatifs d'un titre (normalisés, sans accents, hors mots vides courts). */
function tokens(s: string): Set<string> {
  const norm = String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const toks = norm.split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  return new Set(toks)
}

/** Similarité de Jaccard entre deux ensembles de tokens (0..1). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

function refDate(i: IncidentDedupItem): Date | null {
  const v = i.dateSurvenance ?? i.dateDetection
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Score de proximité de date (1 = même jour, 0 au-delà de la fenêtre / date absente). */
function dateProximity(a: IncidentDedupItem, b: IncidentDedupItem, fenetreJours: number): number {
  const da = refDate(a), db = refDate(b)
  if (!da || !db) return 0
  const diffJours = Math.abs(da.getTime() - db.getTime()) / 86_400_000
  if (diffJours > fenetreJours) return 0
  return 1 - diffJours / fenetreJours
}

/**
 * Cœur du calcul de similarité à partir des ensembles de tokens DÉJÀ calculés —
 * évite de re-tokeniser les titres à chaque comparaison (cf. findDuplicatesForAll).
 */
function similarityWithTokens(
  a: IncidentDedupItem, b: IncidentDedupItem,
  ta: Set<string>, tb: Set<string>, fenetreJours: number,
): number {
  const titre = jaccard(ta, tb)
  const date = dateProximity(a, b, fenetreJours)
  const sameProc = a.processusId && b.processusId && a.processusId === b.processusId ? 1 : 0
  const sameEntite = a.entite && b.entite && a.entite.trim().toLowerCase() === b.entite.trim().toLowerCase() ? 1 : 0
  const score = 0.55 * titre + 0.2 * date + 0.15 * sameProc + 0.1 * sameEntite
  return Math.min(1, score)
}

/**
 * Similarité globale de deux incidents (0..1). Le titre porte l'essentiel du
 * signal ; la proximité de date, le même processus et la même entité renforcent.
 */
export function incidentSimilarity(a: IncidentDedupItem, b: IncidentDedupItem, opts: DedupOptions = {}): number {
  return similarityWithTokens(a, b, tokens(a.intitule), tokens(b.intitule), opts.fenetreJours ?? 14)
}

function toMatch(e: IncidentDedupItem, score: number): DuplicateMatch {
  return { id: e.id, intitule: e.intitule, statut: e.statut, score: Math.round(score * 100) / 100 }
}

/**
 * Doublons probables de `candidate` parmi `existing` : score ≥ seuil, hors la
 * même id et hors incidents REJETE, triés par score décroissant.
 */
export function findIncidentDuplicates(
  candidate: IncidentDedupItem,
  existing: IncidentDedupItem[],
  opts: DedupOptions = {},
): DuplicateMatch[] {
  const seuil = opts.seuil ?? 0.5
  const fenetre = opts.fenetreJours ?? 14
  const candTokens = tokens(candidate.intitule)
  const out: DuplicateMatch[] = []
  for (const e of existing) {
    if (e.id === candidate.id) continue
    if (e.statut === 'REJETE') continue
    const score = similarityWithTokens(candidate, e, candTokens, tokens(e.intitule), fenetre)
    if (score >= seuil) out.push(toMatch(e, score))
  }
  return out.sort((x, y) => y.score - x.score)
}

/**
 * Rapproche TOUS les incidents entre eux en UN passage. Chaque titre n'est
 * tokenisé qu'UNE fois (O(n)) — au lieu de re-tokeniser à chaque appel item par
 * item, qui donnait un coût O(n²) de tokenisation sur la liste. Renvoie, pour
 * chaque id, ses doublons probables (mêmes règles que findIncidentDuplicates).
 */
export function findDuplicatesForAll(
  items: IncidentDedupItem[],
  opts: DedupOptions = {},
): Map<string, DuplicateMatch[]> {
  const seuil = opts.seuil ?? 0.5
  const fenetre = opts.fenetreJours ?? 14
  const toks = items.map((i) => tokens(i.intitule)) // O(n) tokenisation
  const result = new Map<string, DuplicateMatch[]>()
  for (let i = 0; i < items.length; i++) {
    const a = items[i]
    const matches: DuplicateMatch[] = []
    for (let j = 0; j < items.length; j++) {
      const b = items[j]
      if (b.id === a.id) continue
      if (b.statut === 'REJETE') continue
      const score = similarityWithTokens(a, b, toks[i], toks[j], fenetre)
      if (score >= seuil) matches.push(toMatch(b, score))
    }
    matches.sort((x, y) => y.score - x.score)
    result.set(a.id, matches)
  }
  return result
}
