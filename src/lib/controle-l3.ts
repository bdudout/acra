/**
 * controle-l3.ts — Contrôle permanent, lot L3. Module PUR.
 *
 *  - typologie d'un contrôle (préventif / détectif / correctif ; manuel / automatique ;
 *    contrôle clé ; méthode d'échantillonnage) — B-CTL-3 ;
 *  - évaluation de la CONCEPTION, distincte de l'efficacité opérationnelle observée —
 *    B-CTL-2 — et appréciation conjuguée ;
 *  - taille d'échantillon SUGGÉRÉE (proposition modifiable, jamais imposée) — B-CTL-4 ;
 *  - plan annuel d'exécution (une occurrence par période), synthèse et charge par
 *    responsable — B-CTL-1 ;
 *  - contrôle continu : détection d'un flux automatique interrompu — B-CTL-6 ;
 *  - récurrence des anomalies et escalade — B-CTL-7.
 * Les libellés sont traduits côté i18n ; les codes sont stables.
 */

import { prochaineEcheance, etatEcheance, type Periodicite } from './controle'

export const TYPES_CONTROLE = ['PREVENTIF', 'DETECTIF', 'CORRECTIF'] as const
export const MODES_CONTROLE = ['MANUEL', 'AUTOMATIQUE'] as const
export const METHODES_ECHANTILLON = ['FIXE', 'STATISTIQUE', 'ALEATOIRE', 'EXHAUSTIF'] as const
export const CONCEPTIONS = ['ADEQUATE', 'A_AMELIORER', 'INADEQUATE'] as const
export type TypeControle = (typeof TYPES_CONTROLE)[number]
export type ModeControle = (typeof MODES_CONTROLE)[number]
export type MethodeEchantillon = (typeof METHODES_ECHANTILLON)[number]
export type ConceptionStatut = (typeof CONCEPTIONS)[number]

const inList = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null)

export interface Typologie { typeControle: TypeControle | null; modeControle: ModeControle; cle: boolean; methodeEchantillon: MethodeEchantillon | null }

/** Typologie normalisée : valeurs inconnues écartées ; défaut manuel, non clé (rétrocompatible). */
export function sanitizeTypologie(input: { typeControle?: unknown; modeControle?: unknown; cle?: unknown; methodeEchantillon?: unknown }): Typologie {
  return {
    typeControle: inList(TYPES_CONTROLE, input.typeControle),
    modeControle: inList(MODES_CONTROLE, input.modeControle) ?? 'MANUEL',
    cle: input.cle === true,
    methodeEchantillon: inList(METHODES_ECHANTILLON, input.methodeEchantillon),
  }
}

// ─── Conception ──────────────────────────────────────────────────────────────

export interface Conception { statut: ConceptionStatut; commentaire?: string; evaluateurId?: string; evalueLe?: string }

/** Évaluation saisie → forme stockée ; l'évaluateur et la date sont posés par le serveur. */
export function cleanConceptionInput(input: unknown, ctx: { evaluateurId: string; now: Date }): Conception | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  const statut = inList(CONCEPTIONS, o.statut)
  if (!statut) return null
  const commentaire = typeof o.commentaire === 'string' ? o.commentaire.trim().slice(0, 2000) : ''
  return { statut, ...(commentaire ? { commentaire } : {}), evaluateurId: ctx.evaluateurId, evalueLe: ctx.now.toISOString() }
}

/** Lecture d'une valeur stockée (JSON) : vide ou invalide → null. */
export function sanitizeConception(input: unknown): Conception | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  const statut = inList(CONCEPTIONS, o.statut)
  if (!statut) return null
  return {
    statut,
    ...(typeof o.commentaire === 'string' && o.commentaire ? { commentaire: o.commentaire.slice(0, 2000) } : {}),
    ...(typeof o.evaluateurId === 'string' ? { evaluateurId: o.evaluateurId } : {}),
    ...(typeof o.evalueLe === 'string' ? { evalueLe: o.evalueLe } : {}),
  }
}

export type Appreciation = 'EFFICACE' | 'A_SURVEILLER' | 'DEFAILLANT' | 'NON_EVALUE'

/**
 * Appréciation conjuguée : le contrôle est-il bien CONÇU et fonctionne-t-il DANS LA DURÉE ?
 * Défaillant dès qu'une des deux dimensions est mauvaise ; efficace seulement si les deux
 * sont bonnes ; une dimension manquante ne peut jamais donner « efficace ».
 */
export function appreciationControle(conception: ConceptionStatut | null, efficacite: 'FORTE' | 'MOYENNE' | 'FAIBLE' | null): Appreciation {
  if (conception === null && efficacite === null) return 'NON_EVALUE'
  if (conception === 'INADEQUATE' || efficacite === 'FAIBLE') return 'DEFAILLANT'
  if (conception === 'ADEQUATE' && efficacite === 'FORTE') return 'EFFICACE'
  return 'A_SURVEILLER'
}

// ─── Échantillon ─────────────────────────────────────────────────────────────

/**
 * Taille d'échantillon SUGGÉRÉE (règle pratique, modifiable par l'exécutant) : population
 * ≤ 10 → tout ; ≤ 50 → 10 ; ≤ 250 → 25 ; ≤ 1000 → 40 ; au-delà 60 ; contrôle clé ×1,5.
 * Exhaustif = toute la population ; méthode fixe ou population inconnue → aucune suggestion.
 */
export function tailleEchantillonSuggeree(methode: MethodeEchantillon | null, population: number, cle: boolean): number | null {
  if (!methode || methode === 'FIXE' || !(population > 0)) return null
  if (methode === 'EXHAUSTIF') return population
  const base = population <= 10 ? population : population <= 50 ? 10 : population <= 250 ? 25 : population <= 1000 ? 40 : 60
  return Math.min(population, cle ? Math.round(base * 1.5) : base)
}

// ─── Plan annuel ─────────────────────────────────────────────────────────────

export interface ControlePlan { id: string; intitule: string; periodicite: string; responsable: string | null; niveau: string; actif: boolean; cle: boolean; creeLe: Date }
export interface ExecutionPlan { controleId: string; dateRealisation: Date; resultat: string }
export type StatutOccurrence = 'REALISEE' | 'EN_RETARD' | 'EN_COURS' | 'A_VENIR'
export interface OccurrencePlan { index: number; debut: string; fin: string; statut: StatutOccurrence }
export interface LignePlan { controleId: string; occurrences: OccurrencePlan[] }
export interface PlanAnnuel {
  annee: number
  lignes: LignePlan[]
  synthese: { prevues: number; echues: number; realisees: number; enRetard: number; enCours: number; tauxRealisation: number | null }
  parMois: { mois: number; prevues: number; realisees: number; enRetard: number }[]
  charge: { responsable: string; parMois: number[]; pics: number[] }[]
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

/** Périodes de l'année pour une périodicité (mois, trimestres, semestres, année, 52 semaines). */
function periodes(periodicite: string, annee: number): { debut: Date; fin: Date }[] {
  if (periodicite === 'HEBDOMADAIRE') return Array.from({ length: 52 }, (_, k) => ({ debut: utc(annee, 0, 1 + 7 * k), fin: utc(annee, 0, 7 + 7 * k) }))
  const pas = periodicite === 'MENSUEL' ? 1 : periodicite === 'TRIMESTRIEL' ? 3 : periodicite === 'SEMESTRIEL' ? 6 : 12
  return Array.from({ length: 12 / pas }, (_, k) => ({ debut: utc(annee, k * pas, 1), fin: utc(annee, (k + 1) * pas, 0) }))
}

/**
 * Plan d'exécution d'une année : une occurrence par période et par contrôle actif (dès la
 * période où le contrôle existe). Réalisée si une exécution tombe dans la période ; en
 * retard si la période est échue sans exécution ; la période en cours ne pénalise pas.
 */
export function planAnnuel(controles: ControlePlan[], executions: ExecutionPlan[], annee: number, now: Date): PlanAnnuel {
  const lignes: LignePlan[] = []
  const parMois = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, prevues: 0, realisees: 0, enRetard: 0 }))
  const chargeMap = new Map<string, number[]>()
  const s = { prevues: 0, echues: 0, realisees: 0, enRetard: 0, enCours: 0, echuesOuRealisees: 0 }

  for (const c of controles) {
    if (!c.actif) continue
    const execs = executions.filter(e => e.controleId === c.id).map(e => e.dateRealisation.getTime())
    const occurrences: OccurrencePlan[] = []
    let index = 0
    for (const p of periodes(c.periodicite, annee)) {
      const finJour = p.fin.getTime() + 86_400_000 - 1
      if (c.creeLe.getTime() > finJour) continue
      const realisee = execs.some(t => t >= p.debut.getTime() && t <= finJour)
      const echue = finJour < now.getTime()
      const statut: StatutOccurrence = realisee ? 'REALISEE' : echue ? 'EN_RETARD' : p.debut.getTime() <= now.getTime() ? 'EN_COURS' : 'A_VENIR'
      occurrences.push({ index: index++, debut: iso(p.debut), fin: iso(p.fin), statut })

      const m = parMois[p.fin.getUTCMonth()]
      m.prevues++; if (statut === 'REALISEE') m.realisees++; if (statut === 'EN_RETARD') m.enRetard++
      const cle = c.responsable ?? ''
      const ch = chargeMap.get(cle) ?? Array(12).fill(0); ch[p.fin.getUTCMonth()]++; chargeMap.set(cle, ch)
      s.prevues++
      if (echue) s.echues++
      if (statut === 'REALISEE') s.realisees++
      if (statut === 'EN_RETARD') s.enRetard++
      if (statut === 'EN_COURS') s.enCours++
      if (echue || statut === 'REALISEE') s.echuesOuRealisees++
    }
    if (occurrences.length) lignes.push({ controleId: c.id, occurrences })
  }

  const charge = [...chargeMap.entries()].map(([responsable, pm]) => {
    const moy = pm.reduce((a, b) => a + b, 0) / 12
    return { responsable, parMois: pm, pics: pm.flatMap((n, i) => (n >= 3 && n > 1.5 * moy ? [i] : [])) }
  })
  return {
    annee, lignes, parMois, charge,
    synthese: { prevues: s.prevues, echues: s.echues, realisees: s.realisees, enRetard: s.enRetard, enCours: s.enCours, tauxRealisation: s.echuesOuRealisees ? Math.round((s.realisees / s.echuesOuRealisees) * 100) : null },
  }
}

// ─── Contrôle continu, récurrence ────────────────────────────────────────────

/** Un contrôle AUTOMATIQUE actif dont le résultat n'est pas remonté depuis plus d'une période. */
export function fluxInterrompu(c: { modeControle: string; periodicite: string; actif: boolean; creeLe: Date }, derniereExecution: Date | null, now: Date): boolean {
  if (c.modeControle !== 'AUTOMATIQUE' || !c.actif) return false
  return etatEcheance(prochaineEcheance(c.periodicite as Periodicite, derniereExecution, c.creeLe), now) === 'EN_RETARD'
}

export interface Recurrence { consecutives: number; recurrente: boolean }

/**
 * Anomalies récurrentes : deux anomalies consécutives (les plus récentes) ou trois sur
 * les quatre dernières exécutions évaluées. Les « non applicable » ne comptent pas.
 */
export function analyseRecurrence(executions: { resultat: string; dateRealisation: Date | string }[]): Recurrence {
  const evalues = executions.filter(e => e.resultat === 'CONFORME' || e.resultat === 'ANOMALIE')
    .sort((a, b) => new Date(b.dateRealisation).getTime() - new Date(a.dateRealisation).getTime())
  let consecutives = 0
  for (const e of evalues) { if (e.resultat === 'ANOMALIE') consecutives++; else break }
  const dernieres = evalues.slice(0, 4).filter(e => e.resultat === 'ANOMALIE').length
  return { consecutives, recurrente: consecutives >= 2 || dernieres >= 3 }
}

/** Escalade : anomalie récurrente → revue N2 ; récurrente sur un contrôle clé → comité. */
export function escaladeAnomalie(cle: boolean, r: Recurrence): 'N2' | 'COMITE' | null {
  if (!r.recurrente) return null
  return cle ? 'COMITE' : 'N2'
}

// ─── Persistance et vue ──────────────────────────────────────────────────────

/** Champs L3 à la création d'un contrôle (typologie normalisée, conception vide). */
export function champsL3Creation(body: Parameters<typeof sanitizeTypologie>[0]): Typologie & { conception: Record<string, never> } {
  return { ...sanitizeTypologie(body), conception: {} }
}

/**
 * Champs L3 d'une modification PARTIELLE : seuls les champs présents dans le corps sont
 * écrits. `conception` valide → posée avec évaluateur et date ; `null` → effacée ; invalide → ignorée.
 */
export function champsL3Modification(body: Record<string, unknown>, ctx: { evaluateurId: string; now: Date }): Record<string, unknown> {
  const t = sanitizeTypologie(body)
  const out: Record<string, unknown> = {}
  for (const k of ['typeControle', 'modeControle', 'cle', 'methodeEchantillon'] as const) if (k in body) out[k] = t[k]
  if ('conception' in body) {
    if (body.conception === null) out.conception = {}
    else { const c = cleanConceptionInput(body.conception, ctx); if (c) out.conception = c }
  }
  return out
}

export interface VueControleL3 {
  conception: Conception | null
  appreciation: Appreciation
  recurrence: Recurrence
  escalade: 'N2' | 'COMITE' | null
  fluxInterrompu: boolean
}

/** Indicateurs L3 d'un contrôle : appréciation conjuguée, récurrence, escalade, flux continu. */
export function vueControleL3(c: {
  cle: boolean; modeControle: string; periodicite: string; actif: boolean; creeLe: Date; conception: unknown
  efficacite: 'FORTE' | 'MOYENNE' | 'FAIBLE' | null; executions: { resultat: string; dateRealisation: Date | string }[]
}, now: Date): VueControleL3 {
  const conception = sanitizeConception(c.conception)
  const recurrence = analyseRecurrence(c.executions)
  const derniere = c.executions.length ? new Date(Math.max(...c.executions.map(e => new Date(e.dateRealisation).getTime()))) : null
  return {
    conception,
    appreciation: appreciationControle(conception?.statut ?? null, c.efficacite),
    recurrence,
    escalade: escaladeAnomalie(c.cle, recurrence),
    fluxInterrompu: fluxInterrompu({ modeControle: c.modeControle, periodicite: c.periodicite, actif: c.actif, creeLe: c.creeLe }, derniere, now),
  }
}
