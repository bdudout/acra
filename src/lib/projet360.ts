/**
 * projet360.ts — Analyse « Projet 360 » (méthode PROJET_360). Module PUR.
 *
 * Risque opérationnel complet d'un projet, démarche ISO 31000:2018 :
 *  - six DOMAINES (codes = catégories de risques de qualification) ;
 *  - questionnaire de qualification 360 (questions fermées par domaine, stockées
 *    dans Analyse.qualification sous des identifiants `p360.*`) ;
 *  - RÈGLES de risques proposés (moteur existant `suggestedQualificationRisks`),
 *    catalogue traduit dans t.projet360.riskCatalog (clés `p360_*`) ;
 *  - synthèse par domaine (tableau de bord) ;
 *  - double approbation RSSI + Risk Manager.
 * Aucun libellé ici : questions, domaines et risques sont traduits (i18n ×5).
 * Spec : docs/specs/analyse-projet-360.md.
 */

import { suggestedQualificationRisks, type QualificationAnswers, type QualificationRiskRule } from './qualification'
import { sanitizeDirectRisque } from './risque-direct'

export const DOMAINES_360 = ['CYBER', 'IT', 'PROJECT', 'BUSINESS', 'FRAUD', 'OUTSOURCING'] as const
export type Domaine360 = (typeof DOMAINES_360)[number]
export const isDomaine360 = (v: unknown): v is Domaine360 => typeof v === 'string' && (DOMAINES_360 as readonly string[]).includes(v)

export interface Question360 { id: string; domaine: Domaine360; type: 'bool' }

/** Questions fermées (oui/non) ; libellés : t.projet360.questions[id]. */
export const QUESTIONS_360: Question360[] = [
  { id: 'p360.cyber.donneesSensibles', domaine: 'CYBER', type: 'bool' },
  { id: 'p360.cyber.exposeInternet', domaine: 'CYBER', type: 'bool' },
  { id: 'p360.cyber.analyseCyber', domaine: 'CYBER', type: 'bool' },
  { id: 'p360.it.nouvelleArchitecture', domaine: 'IT', type: 'bool' },
  { id: 'p360.it.obsolescence', domaine: 'IT', type: 'bool' },
  { id: 'p360.it.maintenanceDefinie', domaine: 'IT', type: 'bool' },
  { id: 'p360.projet.delaiContraint', domaine: 'PROJECT', type: 'bool' },
  { id: 'p360.projet.budgetSousTension', domaine: 'PROJECT', type: 'bool' },
  { id: 'p360.projet.dependancesMultiples', domaine: 'PROJECT', type: 'bool' },
  { id: 'p360.metier.processusCritique', domaine: 'BUSINESS', type: 'bool' },
  { id: 'p360.metier.conduiteChangement', domaine: 'BUSINESS', type: 'bool' },
  { id: 'p360.metier.exigenceReglementaire', domaine: 'BUSINESS', type: 'bool' },
  { id: 'p360.fraude.fluxFinanciers', domaine: 'FRAUD', type: 'bool' },
  { id: 'p360.fraude.droitsEtendus', domaine: 'FRAUD', type: 'bool' },
  { id: 'p360.fraude.separationTaches', domaine: 'FRAUD', type: 'bool' },
  { id: 'p360.ext.prestataireCritique', domaine: 'OUTSOURCING', type: 'bool' },
  { id: 'p360.ext.cloud', domaine: 'OUTSOURCING', type: 'bool' },
  { id: 'p360.ext.reversibilite', domaine: 'OUTSOURCING', type: 'bool' },
]

type R = { key: string; q: string; equals: boolean; g: number; v: number }
// equals = réponse qui DÉCLENCHE le risque (une mesure absente — « non » — peut
// être le déclencheur : analyse cyber, maintenance, séparation des tâches, réversibilité).
const RULES: R[] = [
  { key: 'fuiteDonnees', q: 'p360.cyber.donneesSensibles', equals: true, g: 3, v: 2 },
  { key: 'compromissionExpose', q: 'p360.cyber.exposeInternet', equals: true, g: 3, v: 3 },
  { key: 'cyberNonApprecie', q: 'p360.cyber.analyseCyber', equals: false, g: 3, v: 2 },
  { key: 'integrationArchitecture', q: 'p360.it.nouvelleArchitecture', equals: true, g: 3, v: 2 },
  { key: 'obsolescence', q: 'p360.it.obsolescence', equals: true, g: 3, v: 3 },
  { key: 'maintienConditions', q: 'p360.it.maintenanceDefinie', equals: false, g: 2, v: 3 },
  { key: 'derivePlanning', q: 'p360.projet.delaiContraint', equals: true, g: 2, v: 3 },
  { key: 'depassementBudget', q: 'p360.projet.budgetSousTension', equals: true, g: 2, v: 3 },
  { key: 'dependancesProjets', q: 'p360.projet.dependancesMultiples', equals: true, g: 2, v: 2 },
  { key: 'interruptionProcessus', q: 'p360.metier.processusCritique', equals: true, g: 4, v: 2 },
  { key: 'adoption', q: 'p360.metier.conduiteChangement', equals: true, g: 2, v: 3 },
  { key: 'nonConformite', q: 'p360.metier.exigenceReglementaire', equals: true, g: 3, v: 2 },
  { key: 'fraudeExterne', q: 'p360.fraude.fluxFinanciers', equals: true, g: 3, v: 2 },
  { key: 'fraudeInterne', q: 'p360.fraude.droitsEtendus', equals: true, g: 3, v: 2 },
  { key: 'separationTaches', q: 'p360.fraude.separationTaches', equals: false, g: 3, v: 3 },
  { key: 'defaillancePrestataire', q: 'p360.ext.prestataireCritique', equals: true, g: 3, v: 2 },
  { key: 'maitriseDonneesCloud', q: 'p360.ext.cloud', equals: true, g: 3, v: 2 },
  { key: 'reversibilite', q: 'p360.ext.reversibilite', equals: false, g: 2, v: 3 },
]

/** Règles de risques proposés du questionnaire 360 (limitées à PROJET_360). */
export const RISK_RULES_360: QualificationRiskRule[] = RULES.map(r => ({
  id: `p360-${r.key}`,
  methods: ['PROJET_360'],
  when: { questionId: r.q, equals: r.equals },
  risk: {
    category: QUESTIONS_360.find(q => q.id === r.q)!.domaine,
    title: '',
    titleKey: `p360_${r.key}`,
    gravity: r.g,
    likelihood: r.v,
    strategy: 'REDUIRE',
  },
}))

/** Réponses 360 nettoyées (booléens des seules questions connues). */
export function sanitizeAnswers360(input: unknown): QualificationAnswers {
  if (!input || typeof input !== 'object') return {}
  const out: QualificationAnswers = {}
  for (const q of QUESTIONS_360) {
    const v = (input as Record<string, unknown>)[q.id]
    if (typeof v === 'boolean') out[q.id] = v
  }
  return out
}

/** Risques proposés par les réponses 360. */
export function suggested360Risks(answers: QualificationAnswers | null | undefined) {
  return suggestedQualificationRisks(answers, RISK_RULES_360, 'PROJET_360')
}

/** Progression du questionnaire par domaine. */
export function progression360(answers: QualificationAnswers | null | undefined): Record<Domaine360, { answered: number; total: number }> {
  const a = answers ?? {}
  return Object.fromEntries(DOMAINES_360.map(d => {
    const qs = QUESTIONS_360.filter(q => q.domaine === d)
    return [d, { answered: qs.filter(q => typeof a[q.id] === 'boolean').length, total: qs.length }]
  })) as Record<Domaine360, { answered: number; total: number }>
}

// ─── Tableau de bord par domaine ─────────────────────────────────────────────

export interface Risque360Lite { id: string; nom: string; domaine: string | null; niveauRisque: number; niveauResiduel: number | null }
export interface Domaine360Stats {
  domaine: Domaine360
  count: number
  maxBrut: number | null
  avgBrut: number | null
  /** Résiduel s'il est coté, sinon brut (le risque non traité reste à son niveau). */
  maxResiduel: number | null
  /** Risques dont le niveau résiduel (ou brut) dépasse l'appétit. */
  aboveAppetite: number
  /** Risques dont le résiduel est coté. */
  treated: number
  top: Risque360Lite[]
}

const round1 = (x: number) => Math.round(x * 10) / 10

export function domainStats360(risques: Risque360Lite[], appetit: number | null | undefined) {
  const domains: Domaine360Stats[] = DOMAINES_360.map(domaine => {
    const rs = risques.filter(r => r.domaine === domaine)
    const effective = rs.map(r => r.niveauResiduel ?? r.niveauRisque)
    return {
      domaine,
      count: rs.length,
      maxBrut: rs.length ? Math.max(...rs.map(r => r.niveauRisque)) : null,
      avgBrut: rs.length ? round1(rs.reduce((n, r) => n + r.niveauRisque, 0) / rs.length) : null,
      maxResiduel: effective.length ? Math.max(...effective) : null,
      aboveAppetite: typeof appetit === 'number' ? effective.filter(n => n > appetit).length : 0,
      treated: rs.filter(r => r.niveauResiduel !== null).length,
      top: [...rs].sort((a, b) => b.niveauRisque - a.niveauRisque).slice(0, 3),
    }
  })
  return { total: risques.length, unclassified: risques.filter(r => !isDomaine360(r.domaine)).length, domains }
}

// ─── Double approbation RSSI + Risk Manager ─────────────────────────────────

export const APPROBATION_ROLES_REQUIS = ['RSSI', 'RISK_MANAGER'] as const
export type ApprobationRole = (typeof APPROBATION_ROLES_REQUIS)[number] | 'ADMIN'
export interface Approbation { role: ApprobationRole; userId: string; le: string; commentaire?: string }
export type ApprobationResult =
  | { ok: true; approbations: Approbation[]; complete: boolean }
  | { ok: false; error: 'ROLE_NON_APPROBATEUR' | 'ROLE_DEJA_APPROUVE' | 'MEME_PERSONNE' }

/** Nettoie la liste stockée (Analyse.approbations). */
export function sanitizeApprobations(input: unknown): Approbation[] {
  if (!Array.isArray(input)) return []
  return input.flatMap(a => {
    if (!a || typeof a !== 'object') return []
    const o = a as Record<string, unknown>
    const role = o.role
    if (role !== 'RSSI' && role !== 'RISK_MANAGER' && role !== 'ADMIN') return []
    if (typeof o.userId !== 'string' || typeof o.le !== 'string') return []
    return [{ role, userId: o.userId, le: o.le, ...(typeof o.commentaire === 'string' && o.commentaire ? { commentaire: o.commentaire } : {}) }]
  })
}

/**
 * Enregistre un avis favorable. Complète quand un RSSI ET un RISK_MANAGER
 * (personnes distinctes) ont approuvé. Un ADMIN (organisations mono-administrateur,
 * dérogation historique) complète l'approbation à lui seul — tracé comme tel.
 */
export function applyApprobation(existing: Approbation[], who: { userId: string; role: string; commentaire?: string }, now: Date): ApprobationResult {
  const isAdmin = who.role === 'ADMIN' || who.role === 'SUPER_ADMIN'
  if (!isAdmin && who.role !== 'RSSI' && who.role !== 'RISK_MANAGER') return { ok: false, error: 'ROLE_NON_APPROBATEUR' }
  if (existing.some(a => a.userId === who.userId)) return { ok: false, error: 'MEME_PERSONNE' }
  const role: ApprobationRole = isAdmin ? 'ADMIN' : (who.role as ApprobationRole)
  if (!isAdmin && existing.some(a => a.role === role)) return { ok: false, error: 'ROLE_DEJA_APPROUVE' }
  const approbations = [...existing, { role, userId: who.userId, le: now.toISOString(), ...(who.commentaire?.trim() ? { commentaire: who.commentaire.trim().slice(0, 2000) } : {}) }]
  const complete = isAdmin || APPROBATION_ROLES_REQUIS.every(r => approbations.some(a => a.role === r))
  return { ok: true, approbations, complete }
}

// ─── Import de risques d'une analyse cyber ───────────────────────────────────

export interface SourceRisque {
  id: string; nom: string; description: string | null
  gravite: number; vraisemblance: number
  graviteActuelle: number | null; vraisemblanceActuelle: number | null
  graviteResiduelle: number | null; vraisemblanceResiduelle: number | null
  strategie: string; proprietaire: string | null; taxonomieCode: string | null
}

/**
 * Plan d'import (copie tracée) des risques SÉLECTIONNÉS d'une analyse cyber, en
 * domaine CYBER : ignore les identifiants inconnus et les risques déjà importés
 * (idempotence par risque source) ; cotations bornées à l'échelle de l'organisation,
 * niveaux recalculés (actuel ← brut, résiduel ← actuel si absents).
 */
export function planCyberImport(args: { sourceAnalyseId: string; source: SourceRisque[]; selectedIds: readonly string[]; alreadyImported: readonly string[]; maxNiveau: number }) {
  const selected = new Set(args.selectedIds)
  const done = new Set(args.alreadyImported)
  return args.source
    .filter(r => selected.has(r.id) && !done.has(r.id))
    .map(r => {
      const p = sanitizeDirectRisque({
        nom: r.nom, description: r.description ?? undefined, strategie: r.strategie,
        gravite: r.gravite, vraisemblance: r.vraisemblance,
        ...(r.graviteActuelle != null ? { graviteActuelle: r.graviteActuelle } : {}),
        ...(r.vraisemblanceActuelle != null ? { vraisemblanceActuelle: r.vraisemblanceActuelle } : {}),
        ...(r.graviteResiduelle != null ? { graviteResiduelle: r.graviteResiduelle } : {}),
        ...(r.vraisemblanceResiduelle != null ? { vraisemblanceResiduelle: r.vraisemblanceResiduelle } : {}),
      }, args.maxNiveau)
      return {
        ...p,
        description: p.description ?? null,
        proprietaire: r.proprietaire, taxonomieCode: r.taxonomieCode,
        domaine: 'CYBER' as const, sourceRisqueId: r.id, sourceAnalyseId: args.sourceAnalyseId,
      }
    })
}
