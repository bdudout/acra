// ─── Packs comités — assemblage de la donnée d'un dossier de comité ──────────
// Un « pack comité » consolide, pour une réunion de gouvernance (comité des
// risques, de conformité, incidents…), les indicateurs clés des modules actifs
// et remonte des points d'alerte. PURE et testée ; le PDF ne fait que rendre.
// Les libellés restent au template (i18n) : ce module ne produit que des CLÉS.

import type { HeatGrid } from '@/lib/carto-export'

export const COMITE_TYPES = ['RISQUES', 'CONFORMITE', 'INCIDENTS'] as const
/** Type de comité (dossier assemblé) : risques, conformité ou incidents. */
export type ComiteType = (typeof COMITE_TYPES)[number]

/** Données GRC consolidées en entrée d'un pack comité (risques, actions, incidents, contrôles, audit…). */
export interface ComiteConsolide {
  risques?: { total: number; eleve: number; moyen: number; faible: number; nonCote: number; grid?: HeatGrid }
  actions?: { total: number; faits: number; enRetard: number; tauxAvancement: number }
  appetit?: { horsAppetit: number; dansAppetit: number; evalues: number }
  incidents?: { total: number; ouverts: number; perteNette: number; aQualifier?: number }
  controles?: {
    tauxConformite: number | null; anomalies: number
    // Segmentation optionnelle par niveau (N1 = 1ʳᵉ ligne, N2 = 2ᵉ ligne) pour le
    // rapport de contrôle interne.
    parNiveau?: { N1?: { tauxConformite: number | null; anomalies: number; controles: number }; N2?: { tauxConformite: number | null; anomalies: number; controles: number } }
  }
  audit?: { critiques: number; recosEnRetard: number }
  regulateur?: { echues: number; sous30j: number }
  kri?: { enAlerte: number; critique: number; total?: number; evalues?: number }
  dora?: { majeurs: number; evalues: number }
}

/** Modules GRC actifs déterminant les sections incluses dans un pack comité. */
export interface ComiteModules {
  risques: boolean; appetit: boolean; incidents: boolean; controles: boolean
  audit: boolean; regulateur: boolean; kri: boolean; dora: boolean
}

/** Une métrique d'un pack comité (clé i18n + valeur, avec drapeaux alerte/positif). */
/** `cible` : valeur visée affichée à côté de l'indicateur (« 80% », « 0 ») ; `cibleMinimum` : la cible est un plancher. Absente sans cible. */
export interface ComiteMetric { key: string; value: number | string; alerte?: boolean; positif?: boolean; cible?: string; cibleMinimum?: boolean
  /** Tendance par rapport à la photo du 1er du mois (état de fin du mois précédent) ; absente sans photo. */
  tendance?: TendanceMetric }
/** Écart à la photo précédente ; `favorable` : null quand l'indicateur n'a pas de sens favorable défini, ou s'il est stable. */
export interface TendanceMetric { precedent: number; delta: number; sens: 'HAUSSE' | 'BAISSE' | 'STABLE'; favorable: boolean | null }
/** Une section d'un pack comité : un groupe de métriques identifié. */
export interface ComiteSection { id: string; metrics: ComiteMetric[] }
/** Un point saillant d'un pack comité (signal d'alerte ou d'information chiffré). */
export interface ComiteHighlight { key: string; niveau: 'alerte' | 'info'; value: number }
/** Pack comité assemblé : type + sections de métriques prêtes à présenter. */
export interface ComitePack {
  type: ComiteType
  sections: ComiteSection[]
  highlights: ComiteHighlight[]
  /** Heatmap gravité × vraisemblance (si le consolidé la fournit) — rendu décideur (#134). */
  heatmap?: HeatGrid
  /** Base d'évaluation du verdict (recette n° 48) : sans risque coté, le verdict est « non évaluable ». */
  base?: BaseEvaluation
}

const CONFORMITE_SEUIL = 80

/** Ordre canonique des sections, réordonné selon le type de comité (priorité). */
const ORDRE_BASE = ['risques', 'appetit', 'incidents', 'controles', 'audit', 'regulateur', 'kri', 'dora'] as const

function ordrePourType(type: ComiteType): readonly string[] {
  if (type === 'CONFORMITE') return ['controles', 'audit', 'regulateur', 'risques', 'appetit', 'kri', 'incidents', 'dora']
  if (type === 'INCIDENTS') return ['incidents', 'dora', 'regulateur', 'kri', 'risques', 'controles', 'audit', 'appetit']
  return ORDRE_BASE
}

/** Assemble le dossier de comité (sections + métriques) à partir de la donnée consolidée et des modules actifs. */
export function buildComitePack(type: ComiteType, c: ComiteConsolide, m: ComiteModules): ComitePack {
  const sectionsById = new Map<string, ComiteSection>()

  if (m.risques && c.risques) {
    const metrics: ComiteMetric[] = [
      { key: 'total', value: c.risques.total },
      { key: 'eleve', value: c.risques.eleve, alerte: c.risques.eleve > 0 },
      { key: 'moyen', value: c.risques.moyen },
      { key: 'faible', value: c.risques.faible },
      { key: 'nonCote', value: c.risques.nonCote },
    ]
    if (c.actions) {
      metrics.push(
        { key: 'actionsTotal', value: c.actions.total },
        { key: 'avancement', value: `${c.actions.tauxAvancement}%` },
        { key: 'actionsEnRetard', value: c.actions.enRetard, alerte: c.actions.enRetard > 0, cible: '0' },
      )
    }
    sectionsById.set('risques', { id: 'risques', metrics })
  }

  if (m.appetit && c.appetit) {
    sectionsById.set('appetit', { id: 'appetit', metrics: [
      { key: 'horsAppetit', value: c.appetit.horsAppetit, alerte: c.appetit.horsAppetit > 0, cible: '0' },
      { key: 'dansAppetit', value: c.appetit.dansAppetit, positif: c.appetit.dansAppetit > 0 },
      { key: 'evalues', value: c.appetit.evalues },
    ] })
  }

  if (m.incidents && c.incidents) {
    sectionsById.set('incidents', { id: 'incidents', metrics: [
      { key: 'total', value: c.incidents.total },
      { key: 'ouverts', value: c.incidents.ouverts, alerte: c.incidents.ouverts > 0 },
      { key: 'perteNette', value: c.incidents.perteNette },
    ] })
  }

  if (m.controles && c.controles) {
    const taux = c.controles.tauxConformite
    sectionsById.set('controles', { id: 'controles', metrics: [
      { key: 'tauxConformite', value: taux == null ? '—' : `${taux}%`, alerte: taux != null && taux < CONFORMITE_SEUIL, positif: taux != null && taux >= CONFORMITE_SEUIL, cible: `${CONFORMITE_SEUIL}%`, cibleMinimum: true },
      { key: 'anomalies', value: c.controles.anomalies, alerte: c.controles.anomalies > 0, cible: '0' },
    ] })
  }

  if (m.audit && c.audit) {
    sectionsById.set('audit', { id: 'audit', metrics: [
      { key: 'critiques', value: c.audit.critiques, alerte: c.audit.critiques > 0, cible: '0' },
      { key: 'recosEnRetard', value: c.audit.recosEnRetard, alerte: c.audit.recosEnRetard > 0, cible: '0' },
    ] })
  }

  if (m.regulateur && c.regulateur) {
    sectionsById.set('regulateur', { id: 'regulateur', metrics: [
      { key: 'echues', value: c.regulateur.echues, alerte: c.regulateur.echues > 0, cible: '0' },
      { key: 'sous30j', value: c.regulateur.sous30j },
    ] })
  }

  if (m.kri && c.kri) {
    sectionsById.set('kri', { id: 'kri', metrics: [
      { key: 'enAlerte', value: c.kri.enAlerte, alerte: c.kri.enAlerte > 0, cible: '0' },
      { key: 'critique', value: c.kri.critique, alerte: c.kri.critique > 0, cible: '0' },
    ] })
  }

  if (m.dora && c.dora) {
    sectionsById.set('dora', { id: 'dora', metrics: [
      { key: 'majeurs', value: c.dora.majeurs, alerte: c.dora.majeurs > 0, cible: '0' },
      { key: 'evalues', value: c.dora.evalues },
    ] })
  }

  const sections: ComiteSection[] = ordrePourType(type)
    .map(id => sectionsById.get(id))
    .filter((s): s is ComiteSection => s != null)

  // Points d'alerte (uniquement pour les modules actifs).
  const highlights: ComiteHighlight[] = []
  const push = (cond: boolean, key: string, niveau: 'alerte' | 'info', value: number) => {
    if (cond) highlights.push({ key, niveau, value })
  }
  if (m.appetit && c.appetit) push(c.appetit.horsAppetit > 0, 'horsAppetit', 'alerte', c.appetit.horsAppetit)
  if (m.risques && c.actions) push(c.actions.enRetard > 0, 'actionsEnRetard', 'alerte', c.actions.enRetard)
  if (m.controles && c.controles && c.controles.tauxConformite != null) push(c.controles.tauxConformite < CONFORMITE_SEUIL, 'conformiteFaible', 'alerte', c.controles.tauxConformite)
  if (m.audit && c.audit) push(c.audit.critiques > 0, 'constatsCritiques', 'alerte', c.audit.critiques)
  if (m.regulateur && c.regulateur) push(c.regulateur.echues > 0, 'regulateurEchu', 'alerte', c.regulateur.echues)
  if (m.kri && c.kri) push(c.kri.critique > 0, 'kriCritique', 'alerte', c.kri.critique)
  if (m.dora && c.dora) push(c.dora.majeurs > 0, 'doraMajeurs', 'alerte', c.dora.majeurs)
  if (m.incidents && c.incidents) push(c.incidents.ouverts > 0, 'incidentsOuverts', 'info', c.incidents.ouverts)
  if (m.incidents && c.incidents) push((c.incidents.aQualifier ?? 0) > 0, 'incidentsAQualifier', 'alerte', c.incidents.aQualifier ?? 0)

  return { type, sections, highlights, base: baseEvaluation(c, m), ...(c.risques?.grid ? { heatmap: c.risques.grid } : {}) }
}

// Signaux d'alerte considérés comme « de crise » pour le verdict global (#134 M5).
const HIGHLIGHTS_CRITIQUES = new Set(['doraMajeurs', 'kriCritique', 'constatsCritiques', 'regulateurEchu'])

/** Verdict global du dispositif : élevé (préoccupant), modéré ou maîtrisé. */
export type VerdictNiveau = 'ELEVE' | 'MODERE' | 'MAITRISE' | 'NON_EVALUABLE'

// ─── Base d'évaluation du verdict (recette n° 48) ───
// Pas de « MAÎTRISÉ » sans base : sans aucun risque coté, le verdict est « non évaluable » (motifs listés) ; les alertes
// l'emportent toujours ; risques cotés mais conformité ou KRI non évalués → « maîtrisé, base partielle ».
export interface BaseEvaluation {
  risquesTotal: number; risquesNonCotes: number
  /** null : module inactif (pas un manque). */
  conformiteEvaluee: boolean | null
  /** null : module inactif. */
  kriEvalues: boolean | null
}
export type ManqueEvaluation = { cle: 'risquesNonCotes'; n: number } | { cle: 'conformiteNonEvaluee' } | { cle: 'kriNonEvalues' }

/** Base d'évaluation d'après le consolidé et les modules actifs (cockpit, dossier de comité, rapport direction). */
export function baseEvaluation(c: ComiteConsolide, m: { controles?: boolean; kri?: boolean }): BaseEvaluation {
  return {
    risquesTotal: c.risques?.total ?? 0, risquesNonCotes: c.risques?.nonCote ?? 0,
    conformiteEvaluee: m.controles ? c.controles?.tauxConformite != null : null,
    kriEvalues: m.kri ? (c.kri?.evalues ?? (c.kri && (c.kri.enAlerte > 0 || c.kri.critique > 0) ? 1 : 0)) > 0 : null,
  }
}

function manques(b: BaseEvaluation): ManqueEvaluation[] {
  const out: ManqueEvaluation[] = []
  if (b.risquesNonCotes > 0) out.push({ cle: 'risquesNonCotes', n: b.risquesNonCotes })
  if (b.conformiteEvaluee === false) out.push({ cle: 'conformiteNonEvaluee' })
  if (b.kriEvalues === false) out.push({ cle: 'kriNonEvalues' })
  return out
}

/** Applique la base au niveau issu des alertes : les alertes priment ; sinon « non évaluable » sans risque coté. */
function appliquerBase(niveau: Exclude<VerdictNiveau, 'NON_EVALUABLE'>, base?: BaseEvaluation): { niveau: VerdictNiveau; manques: ManqueEvaluation[]; partiel: boolean } {
  if (!base) return { niveau, manques: [], partiel: false }
  const m = manques(base)
  if (niveau === 'MAITRISE' && base.risquesTotal - base.risquesNonCotes <= 0) return { niveau: 'NON_EVALUABLE', manques: m, partiel: false }
  return { niveau, manques: m, partiel: m.length > 0 }
}

/**
 * Verdict global du dossier de comité (bandeau RAG en tête, pour que le décideur
 * saisisse le message en < 10 s, #134). ÉLEVÉ si ≥1 signal de crise (constat critique,
 * incident DORA majeur, KRI critique, recommandation régulateur échue) OU ≥4 alertes ;
 * MODÉRÉ si ≥1 alerte ; MAÎTRISÉ sinon. Pur → testable.
 */
export function verdictGlobal(pack: ComitePack): { niveau: VerdictNiveau; alertes: number; manques: ManqueEvaluation[]; partiel: boolean } {
  const alertes = pack.highlights.filter(h => h.niveau === 'alerte')
  const critiques = alertes.filter(h => HIGHLIGHTS_CRITIQUES.has(h.key)).length
  const niveau = critiques > 0 || alertes.length >= 4 ? 'ELEVE' : alertes.length > 0 ? 'MODERE' : 'MAITRISE'
  return { alertes: alertes.length, ...appliquerBase(niveau, pack.base) }
}

/** Signaux d'alerte agrégés servant à calculer le verdict du dispositif (constats critiques, DORA majeurs, KRI…). */
export interface VerdictSignaux {
  constatsCritiques?: number; doraMajeurs?: number; kriCritique?: number; regulateurEchues?: number
  horsAppetit?: number; conformiteSousSeuil?: boolean; actionsEnRetard?: number
  /** Recette n° 48 : incidents signalés non qualifiés (alerte non critique). */
  incidentsAQualifier?: number
}

/**
 * Verdict global du DISPOSITIF pour le cockpit `/pilotage` (#136) — même logique que
 * `verdictGlobal` mais à partir des signaux consolidés bruts (pas d'un ComitePack) :
 * ÉLEVÉ si ≥1 signal de crise (constat critique, DORA majeur, KRI critique, régulateur
 * échu) OU ≥4 alertes ; MODÉRÉ si ≥1 ; MAÎTRISÉ sinon. Pur → testable.
 */
export function verdictDispositif(s: VerdictSignaux, base?: BaseEvaluation): { niveau: VerdictNiveau; alertes: number; manques: ManqueEvaluation[]; partiel: boolean } {
  const critique = (s.constatsCritiques ?? 0) > 0 || (s.doraMajeurs ?? 0) > 0 || (s.kriCritique ?? 0) > 0 || (s.regulateurEchues ?? 0) > 0
  const alertes = verdictSignauxActifs(s).length
  const niveau = critique || alertes >= 4 ? 'ELEVE' : alertes > 0 ? 'MODERE' : 'MAITRISE'
  return { alertes, ...appliquerBase(niveau, base) }
}

// Clés des signaux d'alerte du verdict, ordonnées des plus critiques (crise) aux
// moins critiques → sert à DÉTAILLER « X point(s) d'alerte » dans le cockpit.
export const VERDICT_SIGNAUX_KEYS = [
  'constatsCritiques', 'doraMajeurs', 'kriCritique', 'regulateurEchues',
  'incidentsAQualifier', 'horsAppetit', 'conformiteSousSeuil', 'actionsEnRetard',
] as const
/** Clé d'un signal d'alerte du verdict (identifie « lequel » parmi les signaux actifs). */
export type VerdictSignalKey = (typeof VERDICT_SIGNAUX_KEYS)[number]

/** Liste ORDONNÉE des signaux d'alerte réellement actifs (pour lister « lesquels »). */
export function verdictSignauxActifs(s: VerdictSignaux): VerdictSignalKey[] {
  const actif: Record<VerdictSignalKey, boolean> = {
    constatsCritiques: (s.constatsCritiques ?? 0) > 0,
    doraMajeurs: (s.doraMajeurs ?? 0) > 0,
    kriCritique: (s.kriCritique ?? 0) > 0,
    regulateurEchues: (s.regulateurEchues ?? 0) > 0,
    incidentsAQualifier: (s.incidentsAQualifier ?? 0) > 0,
    horsAppetit: (s.horsAppetit ?? 0) > 0,
    conformiteSousSeuil: s.conformiteSousSeuil === true,
    actionsEnRetard: (s.actionsEnRetard ?? 0) > 0,
  }
  return VERDICT_SIGNAUX_KEYS.filter((k) => actif[k])
}

// ─── Tendance ↑↓ (cadrage 2026-10-11, option a) ─────────────────────────────
// Photo mensuelle des indicateurs (cron `comite-snapshots`, 1er du mois) ; le dossier compare les valeurs actuelles à la
// photo du mois en cours, c'est-à-dire à l'état de fin du mois précédent.
const numerique = (v: number | string): number | null => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
/** Valeurs numériques d'un ou plusieurs dossiers, indexées « section.indicateur » (les clés se répètent d'une section à l'autre). */
export function valeursPack(packs: ComitePack[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of packs) for (const s of p.sections) for (const m of s.metrics) {
    const n = numerique(m.value)
    if (n !== null) out[`${s.id}.${m.key}`] = n
  }
  return out
}
// Sens favorable : hausse pour les taux et ce qui est « dans l'appétit » ; baisse pour les compteurs d'alerte.
const HAUSSE_FAVORABLE = new Set(['avancement', 'tauxConformite', 'dansAppetit'])
function sensFavorable(m: ComiteMetric): 'HAUSSE' | 'BAISSE' | null {
  if (HAUSSE_FAVORABLE.has(m.key) || m.cibleMinimum) return 'HAUSSE'
  if (m.alerte !== undefined) return 'BAISSE'
  return null
}
/** Ajoute à chaque indicateur numérique sa tendance par rapport à la photo `precedent` (null → dossier inchangé). */
export function ajouterTendances(pack: ComitePack, precedent: Record<string, number> | null): ComitePack {
  if (!precedent) return pack
  return {
    ...pack,
    sections: pack.sections.map(s => ({
      ...s,
      metrics: s.metrics.map(m => {
        const actuel = numerique(m.value)
        const avant = precedent[`${s.id}.${m.key}`]
        if (actuel === null || typeof avant !== 'number') return m
        const delta = Math.round((actuel - avant) * 100) / 100
        const sens = delta > 0 ? 'HAUSSE' as const : delta < 0 ? 'BAISSE' as const : 'STABLE' as const
        const bon = sensFavorable(m)
        return { ...m, tendance: { precedent: avant, delta, sens, favorable: sens === 'STABLE' || !bon ? null : sens === bon } }
      }),
    })),
  }
}

/** Texte d'une tendance pour le PDF (Helvetica n'a pas de flèches) : « +2 », « -2 », « = » suivi du suffixe de la langue. */
export function texteTendance(t: TendanceMetric, suffixe: string): string {
  const v = t.sens === 'STABLE' ? '=' : `${t.delta > 0 ? '+' : ''}${t.delta}`
  return `${v} ${suffixe}`
}
