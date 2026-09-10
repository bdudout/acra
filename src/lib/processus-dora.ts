// ─── Criticité DORA & continuité des processus ───────────────────────────────
// Ne pas forcer une échelle unique sur les processus : on distingue
//   (a) la CLASSIFICATION DORA `criticiteDora` — notion de Fonction Critique ou
//       Importante (FCI) : CRITIQUE | IMPORTANTE | NON_CRITIQUE, pertinente pour
//       les sous-secteurs régulés (banque/assurance, règlement DORA) ;
//   (b) les OBJECTIFS DE CONTINUITÉ optionnels : RTO (=DIMA, durée max
//       d'interruption admissible) et RPO (=PDMA, perte de données max admissible),
//       exprimés en minutes.
// Logique PURE : validation/normalisation + formatage de durée. L'UI/API consomme.

export const CRITICITES_DORA = ['CRITIQUE', 'IMPORTANTE', 'NON_CRITIQUE'] as const
export type CriticiteDora = (typeof CRITICITES_DORA)[number]

/** Durée maximale admise pour un objectif de continuité : 1 an en minutes. */
export const DUREE_MINUTES_MAX = 525600

export function cleanCriticiteDora(v: unknown): CriticiteDora | null {
  return CRITICITES_DORA.includes(v as CriticiteDora) ? (v as CriticiteDora) : null
}

/** FCI : la fonction est-elle « critique ou importante » au sens DORA ? */
export function estFciCritiqueImportante(c: unknown): boolean {
  return c === 'CRITIQUE' || c === 'IMPORTANTE'
}

/** Normalise une durée (RTO/RPO) en minutes : entier ≥ 0 borné à 1 an, sinon null. */
export function cleanDureeMinutes(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(DUREE_MINUTES_MAX, Math.round(n))
}

export interface DureeUnites { j: string; h: string; min: string }

/**
 * Formate une durée en minutes → « 1 j 1 h 30 min » (unités localisées).
 * null → « — » ; 0 → « 0 min ». Les composantes nulles sont omises.
 */
export function formatDuree(minutes: number | null, u: DureeUnites): string {
  if (minutes == null) return '—'
  if (minutes === 0) return `0 ${u.min}`
  const j = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  const parts: string[] = []
  if (j) parts.push(`${j} ${u.j}`)
  if (h) parts.push(`${h} ${u.h}`)
  if (m) parts.push(`${m} ${u.min}`)
  return parts.join(' ')
}

/**
 * Résumé des objectifs de continuité, ou null si aucun n'est défini.
 * Renvoie les libellés formatés (ou null par objectif absent).
 */
export function resumeContinuite(
  rtoMinutes: number | null,
  rpoMinutes: number | null,
  u: DureeUnites = { j: 'j', h: 'h', min: 'min' },
): { rto: string | null; rpo: string | null } | null {
  if (rtoMinutes == null && rpoMinutes == null) return null
  return {
    rto: rtoMinutes == null ? null : formatDuree(rtoMinutes, u),
    rpo: rpoMinutes == null ? null : formatDuree(rpoMinutes, u),
  }
}
