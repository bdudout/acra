// ─── Registre des algorithmes et systèmes d'IA (PUR) ──────────────────────────
// Fiche d'un système d'IA (finalité, fournisseur, données, aide ou décision automatisée, intervention humaine, usage,
// contrôles de biais et de dérive, revue, lien analyse / AIPD) et classement INDICATIF au regard du règlement (UE)
// 2024/1689 sur l'intelligence artificielle — toujours « à vérifier » : usages relevant a priori de l'annexe III → haut
// risque probable ; agent conversationnel ou IA générative en aide → obligations de transparence (art. 50) ; sinon à
// qualifier. Revue des biais et de la dérive attendue tous les 12 mois. Testé : registre-ia.test.ts.

export const USAGES_IA = [
  'ELIGIBILITE_PRESTATIONS', 'RECRUTEMENT', 'NOTATION_CREDIT', 'BIOMETRIE', 'DETECTION_FRAUDE',
  'ORIENTATION_USAGERS', 'IA_GENERATIVE', 'TRI_DOCUMENTS', 'AUTRE',
] as const
export type UsageIa = (typeof USAGES_IA)[number]
export const DECISIONS_IA = ['AIDE', 'AUTOMATISEE'] as const
export type DecisionIa = (typeof DECISIONS_IA)[number]
export const STATUTS_IA = ['EN_PROJET', 'EN_SERVICE', 'RETIRE'] as const
export type StatutIa = (typeof STATUTS_IA)[number]
export type ClasseIa = 'HAUT_RISQUE_PROBABLE' | 'RISQUE_LIMITE' | 'A_QUALIFIER'

/** Usages relevant a priori de l'annexe III (biométrie, emploi, accès aux prestations publiques, solvabilité). */
const ANNEXE_III: ReadonlySet<UsageIa> = new Set(['ELIGIBILITE_PRESTATIONS', 'RECRUTEMENT', 'NOTATION_CREDIT', 'BIOMETRIE'])
/** Interaction avec des personnes ou contenu généré : obligations de transparence (art. 50). */
const TRANSPARENCE: ReadonlySet<UsageIa> = new Set(['IA_GENERATIVE', 'ORIENTATION_USAGERS'])

export function classeIndicative(usage: UsageIa, decision: DecisionIa): ClasseIa {
  if (ANNEXE_III.has(usage)) return 'HAUT_RISQUE_PROBABLE'
  if (TRANSPARENCE.has(usage) && decision === 'AIDE') return 'RISQUE_LIMITE'
  return 'A_QUALIFIER'
}

const MOIS_REVUE = 12
export function revueEnRetard(derniereRevue: Date | string | null | undefined, now: Date, statut: StatutIa = 'EN_SERVICE'): boolean {
  if (statut === 'RETIRE') return false
  if (!derniereRevue) return true
  const limite = new Date(now)
  limite.setMonth(limite.getMonth() - MOIS_REVUE)
  return new Date(derniereRevue).getTime() < limite.getTime()
}

export interface SystemeIaSaisie {
  nom: string; finalite: string; fournisseur: string | null; donnees: string[]; categoriesParticulieres: boolean
  typeDecision: DecisionIa; interventionHumaine: string | null; usage: UsageIa; controlesBiais: string | null
  derniereRevue: Date | null; analyseId: string | null; aipdReference: string | null; statut: StatutIa
}

const texte = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const texteOuNull = (v: unknown, max: number): string | null => texte(v, max) || null
const code = <T extends string>(liste: readonly T[], v: unknown, def: T): T => (liste.includes(v as T) ? v as T : def)

export function sanitizeSystemeIa(input: unknown): SystemeIaSaisie {
  const o = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const date = typeof o.derniereRevue === 'string' || o.derniereRevue instanceof Date ? new Date(o.derniereRevue) : null
  return {
    nom: texte(o.nom, 200),
    finalite: texte(o.finalite, 2000),
    fournisseur: texteOuNull(o.fournisseur, 200),
    donnees: Array.isArray(o.donnees) ? [...new Set(o.donnees.map(d => texte(d, 200)).filter(Boolean))].slice(0, 30) : [],
    categoriesParticulieres: o.categoriesParticulieres === true,
    typeDecision: code(DECISIONS_IA, o.typeDecision, 'AIDE'),
    interventionHumaine: texteOuNull(o.interventionHumaine, 2000),
    usage: code(USAGES_IA, o.usage, 'AUTRE'),
    controlesBiais: texteOuNull(o.controlesBiais, 2000),
    derniereRevue: date && !Number.isNaN(date.getTime()) ? date : null,
    analyseId: texteOuNull(o.analyseId, 40),
    aipdReference: texteOuNull(o.aipdReference, 200),
    statut: code(STATUTS_IA, o.statut, 'EN_PROJET'),
  }
}

/** Champs attendus d'une fiche complète (mis en avant « à compléter »). */
export function champsManquantsIa(s: SystemeIaSaisie): ('fournisseur' | 'donnees' | 'interventionHumaine' | 'controlesBiais')[] {
  return [
    ...(s.fournisseur ? [] : ['fournisseur' as const]),
    ...(s.donnees.length ? [] : ['donnees' as const]),
    ...(s.interventionHumaine ? [] : ['interventionHumaine' as const]),
    ...(s.controlesBiais ? [] : ['controlesBiais' as const]),
  ]
}
