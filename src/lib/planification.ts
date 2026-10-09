// ─── Programme pluriannuel d'audit et de contrôle — logique PURE (lot P1) ─────
// Plans d'audit et de contrôle par équipe, horizon pluriannuel, plan annuel validé (figé ou dynamique), lignes
// multi-prismes (périmètres échantillonnés, risques, processus, référentiel et exigences). Configuration de
// l'organisation (`OrganizationConfig.planificationConfig`) : mode par défaut, préparateurs et validateurs par type de
// plan, double regard (désactivé par défaut), seuil des angles morts. Spec : docs/specs/programme-audit-controle.md.
// Testé : planification.test.ts.
import type { UserRole } from './permissions'

export const TYPES_PLAN = ['AUDIT', 'CONTROLE'] as const
export type TypePlan = (typeof TYPES_PLAN)[number]
export const MODES_PLAN = ['FIGE', 'DYNAMIQUE'] as const
export type ModePlan = (typeof MODES_PLAN)[number]
export const PRISMES = ['PERIMETRE', 'RISQUE', 'PROCESSUS', 'REFERENTIEL'] as const
export type Prisme = (typeof PRISMES)[number]
export const STATUTS_ANNEE = ['BROUILLON', 'SOUMIS', 'VALIDE', 'REVISION'] as const
export type StatutAnnee = (typeof STATUTS_ANNEE)[number]
export const METHODES_ECHANTILLON = ['EXHAUSTIF', 'ALEATOIRE', 'RISQUE', 'EXPERT'] as const
export type MethodeEchantillon = (typeof METHODES_ECHANTILLON)[number]
/** Statuts posés à la main sur une ligne (les autres sont calculés à partir des réalisations, lot P4). */
export const STATUTS_MANUELS = ['REPORTEE', 'ANNULEE'] as const

const ROLES: readonly UserRole[] = ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'SUPER_ADMIN', 'DIRECTION_METIER', 'AUDITEUR', 'CONTROLEUR', 'METIER', 'CONFORMITE', 'DPO']

export interface RolesPlan { preparateurs: UserRole[]; validateurs: UserRole[] }
export interface PlanificationConfig {
  modeDefaut: ModePlan
  doubleRegard: boolean
  seuilAnglesMortsAns: number
  AUDIT: RolesPlan
  CONTROLE: RolesPlan
}

export const DEFAULT_PLANIFICATION: PlanificationConfig = {
  modeDefaut: 'FIGE',
  doubleRegard: false,
  seuilAnglesMortsAns: 3,
  // Audit : préparé par l'audit interne, validé par la direction (comité d'audit) ou l'administrateur.
  AUDIT: { preparateurs: ['AUDITEUR'], validateurs: ['DIRECTION_METIER', 'ADMIN'] },
  // Contrôle : préparé par le contrôle permanent ou la conformité, validé par le gestionnaire des risques ou le RSSI.
  CONTROLE: { preparateurs: ['CONTROLEUR', 'CONFORMITE'], validateurs: ['RISK_MANAGER', 'RSSI'] },
}

const roles = (v: unknown, def: UserRole[]): UserRole[] => {
  const out = Array.isArray(v) ? [...new Set(v.filter((r): r is UserRole => ROLES.includes(r as UserRole)))] : []
  return out.length ? out : [...def]
}
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Configuration lue (JSON) : valeurs inconnues ou hors bornes ⇒ défauts ; jamais d'exception. */
export function sanitizePlanificationConfig(raw: unknown): PlanificationConfig {
  const o = isObj(raw) ? raw : {}
  const seuil = Number(o.seuilAnglesMortsAns)
  const rp = (k: TypePlan): RolesPlan => {
    const x = isObj(o[k]) ? o[k] as Record<string, unknown> : {}
    return { preparateurs: roles(x.preparateurs, DEFAULT_PLANIFICATION[k].preparateurs), validateurs: roles(x.validateurs, DEFAULT_PLANIFICATION[k].validateurs) }
  }
  return {
    modeDefaut: MODES_PLAN.includes(o.modeDefaut as ModePlan) ? o.modeDefaut as ModePlan : DEFAULT_PLANIFICATION.modeDefaut,
    doubleRegard: o.doubleRegard === true,
    seuilAnglesMortsAns: Number.isInteger(seuil) && seuil >= 1 && seuil <= 10 ? seuil : DEFAULT_PLANIFICATION.seuilAnglesMortsAns,
    AUDIT: rp('AUDIT'),
    CONTROLE: rp('CONTROLE'),
  }
}

// ─── Saisies ─────────────────────────────────────────────────────────────────

const txt = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim().slice(0, 100)))].slice(0, 200) : [])
const annee = (v: unknown): number | null => { const n = Number(v); return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null }

export interface PlanInput { nom: string; type: TypePlan; equipe: string | null; prismePrincipal: Prisme; mode: ModePlan; anneeDebut: number; anneeFin: number; description: string | null }

/** Création / modification d'un plan : nom requis, type connu, horizon de 1 à 10 ans ; mode par défaut de l'organisation. */
export function cleanPlanInput(body: Record<string, unknown>, modeDefaut: ModePlan): { ok: true; plan: PlanInput } | { ok: false; error: string } {
  const nom = txt(body.nom, 200)
  if (!nom) return { ok: false, error: 'nom_requis' }
  if (!TYPES_PLAN.includes(body.type as TypePlan)) return { ok: false, error: 'type_invalide' }
  const debut = annee(body.anneeDebut) ?? new Date().getUTCFullYear()
  const fin = annee(body.anneeFin) ?? debut
  if (fin < debut || fin - debut > 9) return { ok: false, error: 'horizon_invalide' }
  return { ok: true, plan: {
    nom, type: body.type as TypePlan, equipe: txt(body.equipe, 120) || null,
    prismePrincipal: PRISMES.includes(body.prismePrincipal as Prisme) ? body.prismePrincipal as Prisme : 'PROCESSUS',
    mode: MODES_PLAN.includes(body.mode as ModePlan) ? body.mode as ModePlan : modeDefaut,
    anneeDebut: debut, anneeFin: fin, description: txt(body.description, 4000) || null,
  } }
}

export interface Cibles { organisations: string[]; entites: string[]; tiers: string[]; risques: string[]; processus: string[]; referentiel: { code: string; exigences: string[] } | null }
export interface Echantillon { methode: MethodeEchantillon; population: number | null; taille: number | null }
export interface LigneInput {
  intitule: string; prisme: Prisme; cibles: Cibles; echantillon: Echantillon | null
  debut: string | null; fin: string | null; charge: number | null; priorite: number | null; responsable: string | null
  statutManuel: (typeof STATUTS_MANUELS)[number] | null
}

const isoJour = (v: unknown): string | null | 'invalide' => {
  if (v == null || v === '') return null
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : 'invalide'
}
const entier = (v: unknown, min: number, max: number): number | null => { const n = Number(v); return v != null && v !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null }

/** Ligne d'un plan annuel : cibles multiples dédoublonnées, échantillonnage tracé, période dans l'année du plan. */
export function cleanLigneInput(body: Record<string, unknown>, anneePlan: number, prismePlan: Prisme): { ok: true; ligne: LigneInput } | { ok: false; error: string } {
  const intitule = txt(body.intitule, 300)
  if (!intitule) return { ok: false, error: 'intitule_requis' }
  const debut = isoJour(body.debut), fin = isoJour(body.fin)
  if (debut === 'invalide' || fin === 'invalide') return { ok: false, error: 'date_invalide' }
  for (const d of [debut, fin]) if (d && Number(d.slice(0, 4)) !== anneePlan) return { ok: false, error: 'dates_hors_annee' }
  if (debut && fin && fin < debut) return { ok: false, error: 'dates_inversees' }
  const c = isObj(body.cibles) ? body.cibles : {}
  const ref = isObj(c.referentiel) && txt(c.referentiel.code, 60) ? { code: txt(c.referentiel.code, 60), exigences: ids(c.referentiel.exigences) } : null
  let echantillon: Echantillon | null = null
  if (isObj(body.echantillon) && METHODES_ECHANTILLON.includes(body.echantillon.methode as MethodeEchantillon)) {
    const population = entier(body.echantillon.population, 1, 1_000_000), taille = entier(body.echantillon.taille, 1, 1_000_000)
    if (population != null && taille != null && taille > population) return { ok: false, error: 'echantillon_invalide' }
    echantillon = { methode: body.echantillon.methode as MethodeEchantillon, population, taille }
  }
  const charge = Number(body.charge)
  return { ok: true, ligne: {
    intitule,
    prisme: PRISMES.includes(body.prisme as Prisme) ? body.prisme as Prisme : prismePlan,
    cibles: { organisations: ids(c.organisations), entites: ids(c.entites), tiers: ids(c.tiers), risques: ids(c.risques), processus: ids(c.processus), referentiel: ref },
    echantillon, debut, fin,
    charge: body.charge != null && body.charge !== '' && Number.isFinite(charge) && charge >= 0 && charge <= 10_000 ? Math.round(charge * 10) / 10 : null,
    priorite: entier(body.priorite, 1, 4),
    responsable: txt(body.responsable, 200) || null,
    statutManuel: (STATUTS_MANUELS as readonly string[]).includes(body.statutManuel as string) ? body.statutManuel as LigneInput['statutManuel'] : null,
  } }
}

// ─── Cycle de validation du plan annuel ─────────────────────────────────────

const autorise = (role: UserRole, liste: UserRole[]): boolean => liste.includes(role) || (role === 'SUPER_ADMIN' && liste.includes('ADMIN'))

/** Le rôle peut-il préparer (créer, modifier, soumettre) un plan de ce type ? */
export function peutPreparer(role: UserRole, type: TypePlan, cfg: PlanificationConfig): boolean {
  return autorise(role, cfg[type].preparateurs)
}

/** Le rôle peut-il valider un plan de ce type ? */
export function peutValider(role: UserRole, type: TypePlan, cfg: PlanificationConfig): boolean {
  return autorise(role, cfg[type].validateurs)
}

/** Les lignes d'une année sont-elles modifiables ? Plan figé : en brouillon ou en révision ; dynamique : hors soumission. */
export function peutModifierLignes(statut: StatutAnnee, mode: ModePlan): boolean {
  if (statut === 'SOUMIS') return false
  return mode === 'DYNAMIQUE' || statut === 'BROUILLON' || statut === 'REVISION'
}

export type ActionPlan =
  | { action: 'SOUMETTRE' }
  | { action: 'VALIDER'; commentaire?: string }
  | { action: 'RENVOYER'; commentaire?: string }
  | { action: 'REVISER'; motif?: string }
export interface ContexteTransition { type: TypePlan; mode: ModePlan; role: UserRole; userId: string; preparePar: string | null; config: PlanificationConfig }
export type ResultatTransition =
  | { ok: true; statut: StatutAnnee; patch: Record<string, string>; figer?: true; revision?: true }
  | { ok: false; error: 'transition_interdite' | 'role_preparateur_requis' | 'role_validateur_requis' | 'double_regard' | 'motif_requis' }

/**
 * Transition du plan annuel. Figé : BROUILLON / REVISION → SOUMIS → VALIDE (contenu figé), VALIDE → REVISION avec motif.
 * Dynamique : en plus, VALIDE → SOUMIS pour un nouveau jalon de validation. RENVOYER : SOUMIS → BROUILLON (validateur).
 */
export function transitionPlanAnnee(statut: StatutAnnee, a: ActionPlan, c: ContexteTransition): ResultatTransition {
  if (a.action === 'SOUMETTRE') {
    const depuis: StatutAnnee[] = c.mode === 'DYNAMIQUE' ? ['BROUILLON', 'REVISION', 'VALIDE'] : ['BROUILLON', 'REVISION']
    if (!depuis.includes(statut)) return { ok: false, error: 'transition_interdite' }
    if (!peutPreparer(c.role, c.type, c.config)) return { ok: false, error: 'role_preparateur_requis' }
    return { ok: true, statut: 'SOUMIS', patch: { preparePar: c.userId } }
  }
  if (a.action === 'VALIDER' || a.action === 'RENVOYER') {
    if (statut !== 'SOUMIS') return { ok: false, error: 'transition_interdite' }
    if (!peutValider(c.role, c.type, c.config)) return { ok: false, error: 'role_validateur_requis' }
    if (a.action === 'RENVOYER') return { ok: true, statut: 'BROUILLON', patch: {} }
    if (c.config.doubleRegard && c.preparePar === c.userId) return { ok: false, error: 'double_regard' }
    return { ok: true, statut: 'VALIDE', patch: { validePar: c.userId }, figer: true }
  }
  // REVISER : rouvre un plan validé ; motif obligatoire pour un plan figé (trace de la révision).
  if (statut !== 'VALIDE') return { ok: false, error: 'transition_interdite' }
  if (!peutPreparer(c.role, c.type, c.config)) return { ok: false, error: 'role_preparateur_requis' }
  const motif = (a.motif ?? '').trim().slice(0, 2000)
  if (c.mode === 'FIGE' && !motif) return { ok: false, error: 'motif_requis' }
  return { ok: true, statut: 'REVISION', patch: motif ? { motifRevision: motif } : {}, revision: true }
}

// ─── Relance du plan soumis (cron `relances`) ───────────────────────────────

/**
 * Valideurs à relancer pour une année soumise : membres dont le rôle valide ce type de plan, sans le préparateur quand
 * le double regard est actif ; à défaut, les administrateurs (hors préparateur sous double regard).
 */
export function valideursPlanAnnee(membres: { role: string; userId: string }[], a: { type: TypePlan; preparePar: string | null }, cfg: PlanificationConfig): string[] {
  const exclu = (id: string) => cfg.doubleRegard && id === a.preparePar
  const ids = (ok: (role: UserRole) => boolean) => [...new Set(membres.filter(m => ok(m.role as UserRole) && !exclu(m.userId)).map(m => m.userId))]
  const valideurs = ids(role => peutValider(role, a.type, cfg))
  return valideurs.length ? valideurs : ids(role => role === 'ADMIN' || role === 'SUPER_ADMIN')
}

/** Date de la dernière soumission d'après l'historique des transitions ; `repli` si elle est introuvable. */
export function soumisDepuis(historique: unknown, repli: Date): Date {
  const dates = (Array.isArray(historique) ? historique : [])
    .filter((h): h is { statut: string; le: string } => !!h && typeof h === 'object' && (h as { statut?: unknown }).statut === 'SOUMIS' && typeof (h as { le?: unknown }).le === 'string')
    .map(h => new Date(h.le)).filter(d => !Number.isNaN(d.getTime()))
  return dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : repli
}

export interface LigneFigeable {
  id: string; intitule: string; prisme: string; cibles: unknown; echantillon: unknown
  debut: Date | null; fin: Date | null; charge: number | null; priorite: number | null; responsable: string | null; statutManuel: string | null
}
const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/** Contenu figé d'une année validée : les lignes telles qu'elles étaient, dates au format AAAA-MM-JJ. */
export function figerLignes(lignes: LigneFigeable[]) {
  return lignes.map(l => ({ id: l.id, intitule: l.intitule, prisme: l.prisme, cibles: l.cibles, echantillon: l.echantillon, debut: jour(l.debut), fin: jour(l.fin), charge: l.charge, priorite: l.priorite, responsable: l.responsable, statutManuel: l.statutManuel }))
}

// ─── Graphique annuel ────────────────────────────────────────────────────────

const JOUR_MS = 86_400_000
/** Position d'une période sur la frise de l'année (en % de l'année) ; sans date de début, aucune barre. */
export function positionFrise(debut: string | null, fin: string | null, annee: number): { gauche: number; largeur: number } | null {
  if (!debut) return null
  const t0 = Date.UTC(annee, 0, 1), total = (Date.UTC(annee + 1, 0, 1) - t0) / JOUR_MS
  const d = (Date.parse(`${debut}T00:00:00Z`) - t0) / JOUR_MS
  const f = (Date.parse(`${fin ?? debut}T00:00:00Z`) - t0) / JOUR_MS + 1
  const gauche = Math.max(0, Math.min(100, (d / total) * 100))
  const largeur = Math.max(1, Math.min(100 - gauche, ((f - d) / total) * 100))
  return { gauche: Math.round(gauche * 10) / 10, largeur: Math.round(largeur * 10) / 10 }
}

// ─── Réalisations (lot P4) ───────────────────────────────────────────────────

export const TYPES_REALISATION = ['MISSION', 'CONTROLE', 'CAMPAGNE'] as const
export type TypeRealisation = (typeof TYPES_REALISATION)[number]
export interface Realisation { type: TypeRealisation; id: string }

/** Rattachements d'une ligne : missions d'audit, contrôles, campagnes de contrôle (dédoublonnés, 50 au plus). */
export function cleanRealisations(v: unknown): Realisation[] {
  if (!Array.isArray(v)) return []
  const vus = new Set<string>()
  const out: Realisation[] = []
  for (const r of v) {
    if (!isObj(r) || !TYPES_REALISATION.includes(r.type as TypeRealisation) || typeof r.id !== 'string' || !r.id.trim()) continue
    const k = `${r.type}:${r.id}`
    if (vus.has(k)) continue
    vus.add(k); out.push({ type: r.type as TypeRealisation, id: r.id.trim().slice(0, 100) })
  }
  return out.slice(0, 50)
}

/** État d'une réalisation rattachée : mission / campagne (PLANIFIEE, EN_COURS, CLOTUREE), contrôle (EXECUTE ou non dans l'année). */
export type StatutRealisation = 'PLANIFIEE' | 'EN_COURS' | 'CLOTUREE' | 'EXECUTE' | 'NON_EXECUTE'
export type StatutLigne = 'REALISEE' | 'EN_COURS' | 'EN_RETARD' | 'A_VENIR' | 'REPORTEE' | 'ANNULEE'

/**
 * Statut calculé d'une ligne : le statut posé à la main (reportée, annulée) prime ; sinon réalisée si toutes les
 * réalisations rattachées sont terminées, en cours si l'une est entamée, en retard si la période est passée, en cours
 * pendant la période, à venir avant.
 */
export function statutLigne(l: { debut: string | null; fin: string | null; statutManuel: string | null }, etats: { statut: StatutRealisation }[], aujourdhui: string): StatutLigne {
  if (l.statutManuel === 'ANNULEE' || l.statutManuel === 'REPORTEE') return l.statutManuel
  const termine = (s: StatutRealisation) => s === 'CLOTUREE' || s === 'EXECUTE'
  if (etats.length && etats.every(e => termine(e.statut))) return 'REALISEE'
  if (etats.some(e => e.statut === 'EN_COURS' || termine(e.statut))) return 'EN_COURS'
  const fin = l.fin ?? l.debut
  if (fin && fin < aujourdhui) return 'EN_RETARD'
  if (l.debut && l.debut <= aujourdhui) return 'EN_COURS'
  return 'A_VENIR'
}

export interface CandidatRealisation { type: TypeRealisation; id: string; intitule: string; processus: string[]; risques: string[]; debut: string | null; fin: string | null }

/** Réalisations proposées pour une ligne : au moins un processus ou un risque en commun, période dans l'année du plan ; les plus proches d'abord. */
export function suggererRealisations(ligne: { debut: string | null; fin: string | null; cibles: { processus?: string[]; risques?: string[] } }, annee: number, candidats: CandidatRealisation[]): CandidatRealisation[] {
  const p = new Set(ligne.cibles.processus ?? []), r = new Set(ligne.cibles.risques ?? [])
  const dansAnnee = (c: CandidatRealisation) => !!c.debut && Number(c.debut.slice(0, 4)) <= annee && Number((c.fin ?? c.debut).slice(0, 4)) >= annee
  const ref = Date.parse(`${ligne.debut ?? `${annee}-07-01`}T00:00:00Z`)
  return candidats
    .filter(c => dansAnnee(c) && (c.processus.some(x => p.has(x)) || c.risques.some(x => r.has(x))))
    .map(c => ({ c, communs: c.processus.filter(x => p.has(x)).length + c.risques.filter(x => r.has(x)).length, ecart: Math.abs(Date.parse(`${c.debut}T00:00:00Z`) - ref) }))
    .sort((a, b) => b.communs - a.communs || a.ecart - b.ecart)
    .map(x => x.c)
}

/** Taux de réalisation d'un ensemble de lignes (hors annulées et reportées). */
export function tauxRealisation(statuts: StatutLigne[]): { actives: number; realisees: number; enRetard: number; taux: number | null } {
  const actives = statuts.filter(s => s !== 'ANNULEE' && s !== 'REPORTEE')
  const realisees = actives.filter(s => s === 'REALISEE').length
  return { actives: actives.length, realisees, enRetard: actives.filter(s => s === 'EN_RETARD').length, taux: actives.length ? Math.round((realisees / actives.length) * 100) : null }
}

/** Année transmise (?annee=AAAA) si valide, sinon l'année en cours. */
export function anneeOuCourante(v: string | null): number {
  const n = Number(v)
  return v && Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : new Date().getUTCFullYear()
}
