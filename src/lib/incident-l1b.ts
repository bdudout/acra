/**
 * incident-l1b.ts — Incident, lot L1 (suite). Module PUR.
 *  - chronologie horodatée (détection, escalade, confinement, rétablissement, communication) — B-INC-3 ;
 *  - cause racine (catalogue Bâle : processus, personnes, systèmes, externe ; + tiers) — B-INC-3 ;
 *  - impacts NON financiers (jours d'arrêt, clients / patients touchés, données exposées) — B-PER-5 ;
 *  - allocation d'une perte entre entités et lignes de métier — B-PER-3.
 */

export const TYPES_CHRONOLOGIE = ['DETECTION', 'ESCALADE', 'CONFINEMENT', 'RETABLISSEMENT', 'COMMUNICATION', 'AUTRE'] as const
export type TypeChronologie = (typeof TYPES_CHRONOLOGIE)[number]
export interface EvenementChronologie { type: TypeChronologie; date: string; texte: string }
const MAX_CHRONO = 50

export function sanitizeChronologie(input: unknown): EvenementChronologie[] {
  if (!Array.isArray(input)) return []
  const out: EvenementChronologie[] = []
  for (const r of input) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const type = (TYPES_CHRONOLOGIE as readonly string[]).includes(o.type as string) ? (o.type as TypeChronologie) : null
    const d = typeof o.date === 'string' ? new Date(o.date) : null
    const texte = typeof o.texte === 'string' ? o.texte.trim().slice(0, 500) : ''
    if (!type || !d || Number.isNaN(d.getTime()) || !texte) continue
    out.push({ type, date: d.toISOString(), texte })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, MAX_CHRONO)
}

export const CAUSES_RACINE = ['PROCESSUS', 'PERSONNES', 'SYSTEMES', 'EXTERNE', 'TIERS'] as const
export type CauseRacine = (typeof CAUSES_RACINE)[number]
export const cleanCauseRacine = (v: unknown): CauseRacine | null => ((CAUSES_RACINE as readonly string[]).includes(v as string) ? (v as CauseRacine) : null)

export const UNITES_IMPACT = ['JOURS_ARRET', 'CLIENTS_TOUCHES', 'DONNEES_EXPOSEES', 'PATIENTS_TOUCHES', 'AUTRE'] as const
export interface ImpactNonFinancier { unite: string; valeur: number }
const UNITE_RE = /^[A-Za-z0-9_-]{1,40}$/

/** Impacts nettoyés : valeurs ≥ 0 ; unité inconnue mais mal formée → AUTRE ; une valeur par unité (la dernière). */
export function sanitizeImpacts(input: unknown): ImpactNonFinancier[] {
  if (!Array.isArray(input)) return []
  const map = new Map<string, number>()
  for (const r of input) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const v = typeof o.valeur === 'number' ? o.valeur : Number(o.valeur)
    if (!Number.isFinite(v) || v < 0 || v > 1e12 || typeof o.unite !== 'string' || !o.unite.trim()) continue
    const u = o.unite.trim()
    map.set(UNITE_RE.test(u) ? u : 'AUTRE', v)
  }
  return [...map.entries()].slice(0, 10).map(([unite, valeur]) => ({ unite, valeur }))
}

export interface Allocation { entite: string; ligneMetier?: string; pct: number }
const MAX_ALLOC = 20

export function sanitizeAllocations(input: unknown): { ok: true; allocations: Allocation[] } | { ok: false; error: 'allocation_invalide' } {
  if (!Array.isArray(input)) return { ok: true, allocations: [] }
  const allocations: Allocation[] = []
  for (const r of input) {
    if (allocations.length >= MAX_ALLOC) break
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const entite = typeof o.entite === 'string' ? o.entite.trim().slice(0, 120) : ''
    const pct = typeof o.pct === 'number' ? o.pct : Number(o.pct)
    if (!entite || !Number.isFinite(pct) || pct < 0 || pct > 100) continue
    const lm = typeof o.ligneMetier === 'string' ? o.ligneMetier.trim().slice(0, 60) : ''
    allocations.push({ entite, ...(lm ? { ligneMetier: lm } : {}), pct })
  }
  const somme = allocations.reduce((s, a) => s + a.pct, 0)
  return somme > 100.0001 ? { ok: false, error: 'allocation_invalide' } : { ok: true, allocations }
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Répartit un montant : chaque allocation au centime ; le reliquat non alloué (100 % − Σ) revient à
 * l'entité d'origine. Le total est conservé (le reliquat absorbe les arrondis).
 */
export function allouer(montant: number, allocations: Allocation[], entiteOrigine: string): { entite: string; ligneMetier?: string; montant: number }[] {
  if (allocations.length === 0) return [{ entite: entiteOrigine, ligneMetier: undefined, montant }]
  const lignes = allocations.map(a => ({ entite: a.entite, ligneMetier: a.ligneMetier, montant: r2((montant * a.pct) / 100) }))
  const reste = r2(montant - lignes.reduce((s, l) => s + l.montant, 0))
  if (reste > 0.004) lignes.push({ entite: entiteOrigine, ligneMetier: undefined, montant: reste })
  return lignes
}
