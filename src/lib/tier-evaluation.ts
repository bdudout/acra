// ─── Évaluation d'un usage de service tiers (lot T1) — PUR ────────────────────
// Unité évaluée : l'USAGE d'une offre par une organisation (TierServiceUsage) — le risque porte sur le service fourni, pas
// sur l'entreprise. Mêmes principes que l'atelier 3 d'EBIOS RM (parties prenantes) : 4 critères sur les échelles de
// l'organisation (`echellesEcosysteme`), menace = (dépendance × pénétration) / (maturité × confiance), zones
// veille / contrôle / danger du radar ; cotation ACTUELLE et CIBLE (résiduelle) ; clauses contractuelles types de
// l'atelier 3. Évaluée par le propriétaire du risque ou l'analyste, validée par le RSSI ; rattachée aux risques
// d'externalisation du registre ; réévaluation 12 mois après la validation (lib/revues).
// Spec : docs/specs/evaluation-tiers-par-usage.md. Testé : tier-evaluation.test.ts.
import { CRITERES_ECOSYSTEME, maxValeur, type CritereEcosysteme, type EchellesEcosysteme } from '@/lib/ecosystem-echelles'
import { zoneOf, type EcosystemZone } from '@/lib/ecosystem-radar'
import { CONTRACTUAL_CLAUSE_KEYS, type ContractualClauseKey } from '@/lib/ecosystem-contractual-clauses'
import { echeanceRevue } from '@/lib/revues'
import type { UserRole } from '@/lib/permissions'

export type Cotation = Record<CritereEcosysteme, number | null>
export interface EvaluationTiersSaisie {
  actuelle: Cotation; cible: Cotation | null
  clauses: ContractualClauseKey[]; traitementIds: string[]; risqueIds: string[]; justification: string
}
export const STATUTS_EVALUATION_TIERS = ['BROUILLON', 'SOUMISE', 'VALIDEE'] as const
export type StatutEvaluationTiers = (typeof STATUTS_EVALUATION_TIERS)[number]

const ids = (v: unknown, max = 50): string[] => [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim().slice(0, 64)))].slice(0, max)
function cotation(v: unknown, e: EchellesEcosysteme): Cotation {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  return Object.fromEntries(CRITERES_ECOSYSTEME.map(c => {
    const n = typeof o[c] === 'number' && Number.isFinite(o[c]) ? (o[c] as number) : null
    return [c, n === null ? null : Math.min(maxValeur(e[c]), Math.max(1, Math.round(n)))]
  })) as Cotation
}

/** Saisie assainie : critères bornés aux échelles de l'organisation, clauses connues, identifiants dédoublonnés. */
export function sanitizeEvaluationTiers(input: unknown, e: EchellesEcosysteme): EvaluationTiersSaisie {
  const o = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  return {
    actuelle: cotation(o.actuelle, e),
    cible: o.cible && typeof o.cible === 'object' ? cotation(o.cible, e) : null,
    clauses: (Array.isArray(o.clauses) ? o.clauses : []).filter((c): c is ContractualClauseKey => (CONTRACTUAL_CLAUSE_KEYS as readonly unknown[]).includes(c)).filter((c, i, a) => a.indexOf(c) === i),
    traitementIds: ids(o.traitementIds), risqueIds: ids(o.risqueIds),
    justification: typeof o.justification === 'string' ? o.justification.trim().slice(0, 4000) : '',
  }
}

export interface Niveau { exposition: number; fiabilite: number; menace: number; zone: EcosystemZone }
const complete = (c: Cotation | null): c is Record<CritereEcosysteme, number> => !!c && CRITERES_ECOSYSTEME.every(k => typeof c[k] === 'number')
function niveau(c: Cotation | null): Niveau | null {
  if (!complete(c)) return null
  const exposition = c.dependance * c.penetration
  const fiabilite = c.maturite * c.confiance
  const menace = exposition / fiabilite
  return { exposition, fiabilite, menace, zone: zoneOf(menace) }
}
/** Menace et zone, actuelle et cible (null tant que les 4 critères ne sont pas cotés). */
export function coterEvaluation(ev: Pick<EvaluationTiersSaisie, 'actuelle' | 'cible'>, _e: EchellesEcosysteme): { actuelle: Niveau | null; cible: Niveau | null } {
  return { actuelle: niveau(ev.actuelle), cible: niveau(ev.cible) }
}

// ─── Droits et cycle ───
const EVALUATEURS: UserRole[] = ['ANALYSTE', 'RISK_MANAGER', 'DIRECTION_METIER', 'RSSI', 'CONFORMITE', 'DPO', 'ADMIN', 'SUPER_ADMIN']
/** Évalue et soumet : le propriétaire du risque (direction métier, gestionnaire des risques) ou l'analyste, et la gouvernance. */
export const peutEvaluerTiers = (role: UserRole): boolean => EVALUATEURS.includes(role)
/** Valide : le RSSI ; en petite structure, l'administrateur aussi. */
export const peutValiderEvaluationTiers = (role: UserRole, o: { petiteStructure?: boolean }): boolean =>
  role === 'RSSI' || (!!o.petiteStructure && (role === 'ADMIN' || role === 'SUPER_ADMIN'))

export type ActionEvaluationTiers = 'SOUMETTRE' | 'VALIDER' | 'RENVOYER' | 'MODIFIER'
export type TransitionTiers = { ok: true; statut: StatutEvaluationTiers } | { ok: false; error: 'transition_interdite' | 'cotation_incomplete' | 'role_validateur_requis' | 'role_evaluateur_requis' }
export function transitionEvaluationTiers(statut: StatutEvaluationTiers, action: ActionEvaluationTiers, c: { role: UserRole; petiteStructure?: boolean; evaluation: Pick<EvaluationTiersSaisie, 'actuelle' | 'cible'> }): TransitionTiers {
  if (action === 'MODIFIER') return peutEvaluerTiers(c.role) ? { ok: true, statut: 'BROUILLON' } : { ok: false, error: 'role_evaluateur_requis' }
  if (action === 'SOUMETTRE') {
    if (statut !== 'BROUILLON') return { ok: false, error: 'transition_interdite' }
    if (!peutEvaluerTiers(c.role)) return { ok: false, error: 'role_evaluateur_requis' }
    return complete(c.evaluation.actuelle) ? { ok: true, statut: 'SOUMISE' } : { ok: false, error: 'cotation_incomplete' }
  }
  if (statut !== 'SOUMISE') return { ok: false, error: 'transition_interdite' }
  if (!peutValiderEvaluationTiers(c.role, c)) return { ok: false, error: 'role_validateur_requis' }
  return { ok: true, statut: action === 'VALIDER' ? 'VALIDEE' : 'BROUILLON' }
}

/** Réévaluation 12 mois après la validation (même règle que les revues périodiques) ; aucune tant que non validée. */
export function prochaineEvaluation(valideLe: Date | null): Date | null {
  return valideLe ? echeanceRevue(valideLe, valideLe) : null
}

/** Synthèse d'un ensemble d'usages (offre, tiers, organisation, groupe) : pire menace actuelle, jamais une moyenne. */
export function synthesePireNiveau(niveaux: (Pick<Niveau, 'menace' | 'zone'> | null)[]): { menace: number; zone: EcosystemZone; evalues: number } | null {
  const ok = niveaux.filter((n): n is Pick<Niveau, 'menace' | 'zone'> => !!n)
  if (!ok.length) return null
  const pire = ok.reduce((a, b) => (b.menace > a.menace ? b : a))
  return { menace: pire.menace, zone: pire.zone, evalues: ok.length }
}
