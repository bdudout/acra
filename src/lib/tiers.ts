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
  /**
   * Analyses où le tiers apparaît (dédupliquées), avec le **score contextuel**
   * de ce tiers DANS chaque analyse (menace/zone du pire cas local) : un même
   * prestataire peut être « danger » dans une analyse et « veille » dans une autre.
   */
  analyses: { analyseId: string; analyseNom: string; entite?: string | null; menace: number; zone: EcosystemZone }[]
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

/**
 * Signature stable d'un groupe de doublons : clés normalisées triées puis jointes.
 * Sert de clé de persistance pour « ignorer » un groupe — indépendante de l'ordre.
 * Si la composition du groupe change (nouveau tiers rapproché), la signature change
 * → le groupe réapparaît (situation nouvelle à réexaminer). Pur, testé.
 */
export function tierGroupSignature(group: { key: string }[]): string {
  return (group ?? [])
    .map(g => String(g?.key ?? ''))
    .filter(Boolean)
    .sort()
    .join('|')
}

// ─── Fusion de doublons (étape 2b, écriture) ─────────────────────────────────

/** Longueur maximale d'un nom de tiers cible. */
const MERGE_NAME_MAX = 200
/**
 * Nombre maximal de noms acceptés dans une demande de fusion (anti-DoS, #118) :
 * borne la clause SQL `IN` générée côté route. Une fusion légitime porte sur
 * quelques variantes d'un même tiers, jamais des dizaines de milliers.
 */
const MERGE_MAX_NOMS = 100

/**
 * Valide une demande de fusion AVANT toute écriture. Renvoie un code d'erreur
 * (clé i18n) ou `null` si la requête est valide. Pur, testé.
 */
export function validateMergeRequest(noms: string[], cible: string): 'cible_vide' | 'cible_trop_longue' | 'pas_assez_de_noms' | 'trop_de_noms' | 'nom_trop_long' | null {
  const target = String(cible ?? '').trim()
  if (!target) return 'cible_vide'
  if (target.length > MERGE_NAME_MAX) return 'cible_trop_longue'
  const list = noms ?? []
  // Anti-DoS (#118) : borne la taille du tableau et la longueur de chaque élément
  // avant qu'ils n'alimentent une requête Prisma `nom: { in: noms }`.
  if (list.length > MERGE_MAX_NOMS) return 'trop_de_noms'
  if (list.some(n => typeof n === 'string' && n.length > MERGE_NAME_MAX)) return 'nom_trop_long'
  // Au moins deux noms NORMALISÉS distincts : fusionner « Microsoft »/« microsoft »
  // n'a aucun sens (la consolidation les regroupe déjà).
  const uniq = new Set(list.map(normalizeTierName).filter(Boolean))
  if (uniq.size < 2) return 'pas_assez_de_noms'
  return null
}

/**
 * Détermine les parties prenantes à renommer vers `cible` parmi `rows`, en ne
 * retenant que celles que l'utilisateur peut éditer (prédicat `canEdit` injecté
 * → testable sans DB). Les PP déjà nommées `cible` sont ignorées (no-op). Les PP
 * non éditables sont comptées dans `blocked`. Pur, testé.
 */
export function planTierRename<C extends { id: string; nom: string }>(
  rows: C[],
  cible: string,
  canEdit: (row: C) => boolean
): { renameIds: string[]; blocked: number } {
  const target = String(cible ?? '').trim()
  const renameIds: string[] = []
  let blocked = 0
  for (const r of rows ?? []) {
    if (r.nom === target) continue // déjà au bon nom
    if (canEdit(r)) renameIds.push(r.id)
    else blocked++
  }
  return { renameIds, blocked }
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
    // Score CONTEXTUEL par analyse : on conserve le pire cas (menace max) DANS
    // chaque analyse, en préservant l'ordre de première apparition.
    const perAnalyse = new Map<string, { analyseId: string; analyseNom: string; entite?: string | null; menace: number; zone: EcosystemZone }>()
    for (const r of g) {
      const cur = perAnalyse.get(r.analyseId)
      if (!cur || r.menace > cur.menace) {
        perAnalyse.set(r.analyseId, { analyseId: r.analyseId, analyseNom: r.analyseNom, entite: r.entite ?? null, menace: r.menace, zone: r.zone })
      }
    }
    const analyses = [...perAnalyse.values()]
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
