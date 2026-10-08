// ─── Suivi de l'AIPD d'un traitement (RGPD art. 35-36) — PUR ──────────────────
// Statut (à réaliser, en cours, réalisée, non retenue), rattachement à une analyse ACRA, date de réalisation,
// justification d'une AIPD non retenue alors qu'un critère de risque élevé est présent (la décision de ne pas réaliser
// d'AIPD doit être documentée), consultation préalable de l'autorité de contrôle (art. 36) quand le risque résiduel
// reste élevé. Le niveau (REQUISE / A_EXAMINER / NON) vient de lib/ropa (critères WP248). Testé : ropa-aipd.test.ts.

export const STATUTS_AIPD = ['A_REALISER', 'EN_COURS', 'REALISEE', 'NON_RETENUE'] as const
export type StatutAipd = (typeof STATUTS_AIPD)[number]
type Niveau = 'REQUISE' | 'A_EXAMINER' | 'NON'

export interface SuiviAipd {
  aipdStatut: StatutAipd | null
  aipdAnalyseId: string | null
  aipdDate: Date | null
  aipdJustification: string
  aipdConsultationPrealable: boolean
}

export function sanitizeSuiviAipd(v: unknown): SuiviAipd {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const d = typeof o.aipdDate === 'string' || o.aipdDate instanceof Date ? new Date(o.aipdDate as string) : null
  return {
    aipdStatut: STATUTS_AIPD.includes(o.aipdStatut as StatutAipd) ? (o.aipdStatut as StatutAipd) : null,
    aipdAnalyseId: typeof o.aipdAnalyseId === 'string' && o.aipdAnalyseId.trim() ? o.aipdAnalyseId.trim().slice(0, 64) : null,
    aipdDate: d && !Number.isNaN(d.getTime()) ? d : null,
    aipdJustification: typeof o.aipdJustification === 'string' ? o.aipdJustification.trim().slice(0, 2000) : '',
    aipdConsultationPrealable: o.aipdConsultationPrealable === true,
  }
}

/** Point d'attention du DPO : AIPD requise non engagée, ou AIPD écartée sans justification. */
export function alerteAipd(niveau: Niveau, s: Pick<SuiviAipd, 'aipdStatut' | 'aipdJustification'>): 'A_LANCER' | 'JUSTIFICATION_REQUISE' | null {
  if (niveau === 'REQUISE' && (!s.aipdStatut || s.aipdStatut === 'A_REALISER')) return 'A_LANCER'
  if (niveau !== 'NON' && s.aipdStatut === 'NON_RETENUE' && !s.aipdJustification.trim()) return 'JUSTIFICATION_REQUISE'
  return null
}

/** Refus d'enregistrement : « non retenue » sans justification alors qu'un critère est présent. */
export function validerSuiviAipd(niveau: Niveau, s: Pick<SuiviAipd, 'aipdStatut' | 'aipdJustification'>): 'justification_requise' | null {
  return niveau !== 'NON' && s.aipdStatut === 'NON_RETENUE' && !s.aipdJustification.trim() ? 'justification_requise' : null
}
