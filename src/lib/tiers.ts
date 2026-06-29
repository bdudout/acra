/**
 * tiers.ts — Consolidation des tiers (parties prenantes) à travers les analyses.
 *
 * Gestion des tiers, étape 1 (sans migration) : un même tiers (ex. « Microsoft »)
 * apparaît comme partie prenante dans plusieurs analyses, chacune avec ses propres
 * scores. Cette consolidation regroupe par NOM normalisé et remonte le **pire cas**
 * (approche conservatrice : la menace la plus forte / la fiabilité la plus faible
 * pèse au niveau de l'entité). Étape 2 (table Tiers dédiée + fusion de doublons)
 * viendra ensuite.
 *
 * Module pur → testé unitairement (tiers.test.ts).
 */
import type { EcosystemZone } from '@/lib/ecosystem-radar'

export interface TierInput {
  nom: string
  type: string
  analyseId: string
  analyseNom: string
  analyseOrg?: string | null
  entite?: string | null
  exposition: number
  fiabilite: number
  dependance?: number
  penetration?: number
  maturite?: number
  confiance?: number
  menace: number
  zone: EcosystemZone
  critique?: boolean
}

export interface ConsolidatedTier {
  /** Clé normalisée du regroupement. */
  key: string
  /** Libellé représentatif (orthographe la plus fréquente). */
  nom: string
  type: string
  /** Nombre d'occurrences (parties prenantes) regroupées. */
  occurrences: number
  /** Analyses où le tiers apparaît (dédupliquées). */
  analyses: { analyseId: string; analyseNom: string; entite?: string | null }[]
  // Pire cas (conservateur)
  menace: number
  zone: EcosystemZone
  exposition: number
  fiabilite: number
  critique: boolean
}

/** Normalise un nom de tiers : minuscules, sans accents, espaces compactés. */
export function normalizeTierName(nom: string): string {
  return String(nom ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

// Mots vides ignorés pour le rapprochement de doublons (suffixes corporate fréquents).
const TIER_STOPWORDS = new Set(['sa', 'sas', 'sarl', 'inc', 'ltd', 'llc', 'gmbh', 'group', 'groupe', 'france', 'cloud', 'services', 'service', 'solutions', 'technologies', 'corp'])

/** Premier token significatif (≥ 3 lettres, hors mots vides) d'un nom normalisé. */
function leadToken(key: string): string {
  for (const tok of key.split(' ')) {
    if (tok.length >= 3 && !TIER_STOPWORDS.has(tok)) return tok
  }
  return key.split(' ')[0] ?? key
}

/**
 * Détecte des groupes de tiers probablement identiques (doublons à harmoniser),
 * p. ex. « Microsoft » / « Microsoft Azure » / « Microsoft 365 ». Heuristique en
 * LECTURE SEULE (aucune écriture) : regroupe par premier token significatif partagé.
 * Renvoie uniquement les groupes d'au moins 2 tiers distincts. Pur, testé.
 */
export function suggestTierDuplicates(tiers: ConsolidatedTier[]): ConsolidatedTier[][] {
  const byLead = new Map<string, ConsolidatedTier[]>()
  for (const t of tiers) {
    const lead = leadToken(t.key)
    if (!lead) continue
    const g = byLead.get(lead)
    if (g) g.push(t); else byLead.set(lead, [t])
  }
  return [...byLead.values()].filter(g => g.length >= 2)
}

/** Renvoie l'élément le plus fréquent d'une liste (1er en cas d'égalité). */
function mostFrequent<T>(items: T[]): T {
  const counts = new Map<T, number>()
  let best = items[0]
  let bestN = 0
  for (const it of items) {
    const n = (counts.get(it) ?? 0) + 1
    counts.set(it, n)
    if (n > bestN) { bestN = n; best = it }
  }
  return best
}

/**
 * Regroupe les tiers par nom normalisé et calcule le pire cas par entité.
 * Tri par menace décroissante (les tiers les plus menaçants en tête).
 */
export function consolidateTiers(rows: TierInput[]): ConsolidatedTier[] {
  const groups = new Map<string, TierInput[]>()
  for (const r of rows ?? []) {
    const key = normalizeTierName(r.nom)
    if (!key) continue
    const g = groups.get(key)
    if (g) g.push(r); else groups.set(key, [r])
  }

  const out: ConsolidatedTier[] = []
  for (const [key, g] of groups) {
    // Occurrence la plus menaçante → porte la menace + la zone (cohérence).
    const worst = g.reduce((a, b) => (b.menace > a.menace ? b : a))
    const analyses: { analyseId: string; analyseNom: string; entite?: string | null }[] = []
    const seen = new Set<string>()
    for (const r of g) {
      if (seen.has(r.analyseId)) continue
      seen.add(r.analyseId)
      analyses.push({ analyseId: r.analyseId, analyseNom: r.analyseNom, entite: r.entite ?? null })
    }
    out.push({
      key,
      nom: mostFrequent(g.map(r => r.nom)),
      type: mostFrequent(g.map(r => r.type)),
      occurrences: g.length,
      analyses,
      menace: worst.menace,
      zone: worst.zone,
      exposition: Math.max(...g.map(r => r.exposition)),
      fiabilite: Math.min(...g.map(r => r.fiabilite)),
      critique: g.some(r => !!r.critique),
    })
  }
  return out.sort((a, b) => b.menace - a.menace)
}
