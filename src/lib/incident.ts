// ─── Module M2 — Incidents & pertes ──────────────────────────────────────────
// Déclaration d'incident par la 1ʳᵉ ligne (formulaire court), qualification par
// la 2ᵉ ligne (taxonomie, coût réel, rattachement au registre), puis clôture.
// Les pertes suivent la logique de la LDC bancaire (Bâle) : brut, récupérations,
// net = brut − récupérations. Logique PURE et testée.

export const INCIDENT_STATUTS = ['DECLARE', 'QUALIFIE', 'CLOTURE', 'REJETE'] as const
export type IncidentStatut = (typeof INCIDENT_STATUTS)[number]

// Gravité ressentie au moment de la déclaration (échelle 1-4, volontairement
// courte : la 1ʳᵉ ligne ne cote pas finement, elle signale).
export const IMPACT_MIN = 1
export const IMPACT_MAX = 4

export interface IncidentInput {
  intitule?: unknown
  description?: unknown
  dateSurvenance?: unknown
  dateDetection?: unknown
  taxonomieCode?: unknown
  processusId?: unknown
  entite?: unknown
  impactEstime?: unknown
  montantBrut?: unknown
  recuperations?: unknown
  riskItemId?: unknown
  statut?: unknown
}

export interface CleanIncident {
  intitule: string
  description: string | null
  dateSurvenance: Date | null
  dateDetection: Date | null
  taxonomieCode: string | null
  processusId: string | null
  entite: string | null
  impactEstime: number | null
  montantBrut: number | null
  recuperations: number | null
  riskItemId: string | null
  statut: IncidentStatut
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseMontant(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (Number.isNaN(n)) return null
  // Montants négatifs refusés en amont (validateIncidentInput) ; ici on borne.
  return Math.max(0, Math.round(n * 100) / 100)
}

const txt = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

/** Renvoie un code d'erreur i18n, ou null si l'entrée est valide. */
export function validateIncidentInput(body: IncidentInput): string | null {
  if (typeof body.intitule !== 'string' || body.intitule.trim() === '') return 'intitule_requis'
  if (body.dateSurvenance != null && body.dateSurvenance !== '' && parseDate(body.dateSurvenance) == null) return 'date_invalide'
  if (body.dateDetection != null && body.dateDetection !== '' && parseDate(body.dateDetection) == null) return 'date_invalide'

  // La détection ne peut pas précéder la survenance.
  const surv = parseDate(body.dateSurvenance)
  const det = parseDate(body.dateDetection)
  if (surv && det && det.getTime() < surv.getTime()) return 'detection_avant_survenance'

  if (body.impactEstime != null && body.impactEstime !== '') {
    const n = Number(body.impactEstime)
    if (!Number.isInteger(n) || n < IMPACT_MIN || n > IMPACT_MAX) return 'impact_invalide'
  }
  for (const champ of ['montantBrut', 'recuperations'] as const) {
    const v = body[champ]
    if (v != null && v !== '') {
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
      if (Number.isNaN(n) || n < 0) return 'montant_invalide'
    }
  }
  // Les récupérations ne peuvent pas dépasser la perte brute.
  const brut = parseMontant(body.montantBrut)
  const recup = parseMontant(body.recuperations)
  if (brut != null && recup != null && recup > brut) return 'recuperations_superieures'

  if (body.statut != null && !INCIDENT_STATUTS.includes(body.statut as IncidentStatut)) return 'statut_invalide'
  return null
}

export function cleanIncidentInput(body: IncidentInput): CleanIncident {
  const s = body.statut as IncidentStatut
  return {
    intitule: String(body.intitule).trim(),
    description: txt(body.description),
    dateSurvenance: parseDate(body.dateSurvenance),
    dateDetection: parseDate(body.dateDetection),
    taxonomieCode: txt(body.taxonomieCode),
    processusId: txt(body.processusId),
    entite: txt(body.entite),
    impactEstime: body.impactEstime == null || body.impactEstime === '' ? null
      : Math.min(IMPACT_MAX, Math.max(IMPACT_MIN, Math.round(Number(body.impactEstime)))),
    montantBrut: parseMontant(body.montantBrut),
    recuperations: parseMontant(body.recuperations),
    riskItemId: txt(body.riskItemId),
    statut: INCIDENT_STATUTS.includes(s) ? s : 'DECLARE',
  }
}

/**
 * Perte NETTE (LDC) = brut − récupérations, jamais négative.
 * `null` si aucune perte brute n'est renseignée (incident sans impact financier
 * chiffré : il compte quand même en fréquence).
 */
export function perteNette(montantBrut: number | null, recuperations: number | null): number | null {
  if (montantBrut == null) return null
  return Math.max(0, Math.round((montantBrut - (recuperations ?? 0)) * 100) / 100)
}

/** Délai de détection en jours (survenance → détection) ; null si incalculable. */
export function delaiDetection(dateSurvenance: Date | string | null, dateDetection: Date | string | null): number | null {
  if (!dateSurvenance || !dateDetection) return null
  const s = new Date(dateSurvenance).getTime()
  const d = new Date(dateDetection).getTime()
  if (Number.isNaN(s) || Number.isNaN(d)) return null
  return Math.max(0, Math.round((d - s) / 86_400_000))
}

// ─── Transitions du cycle de vie ─────────────────────────────────────────────

/** Statuts terminaux : plus aucune transition possible. */
export function estTerminal(statut: IncidentStatut): boolean {
  return statut === 'CLOTURE' || statut === 'REJETE'
}

/** Transitions autorisées : DECLARE → QUALIFIE|REJETE ; QUALIFIE → CLOTURE|REJETE. */
export function transitionAutorisee(depuis: IncidentStatut, vers: IncidentStatut): boolean {
  if (depuis === vers) return true
  if (depuis === 'DECLARE') return vers === 'QUALIFIE' || vers === 'REJETE'
  if (depuis === 'QUALIFIE') return vers === 'CLOTURE' || vers === 'REJETE'
  return false
}

/** La qualification exige une taxonomie (c'est son objet même). */
export function qualificationComplete(i: { taxonomieCode: string | null }): boolean {
  return !!i.taxonomieCode
}

// ─── Boucle incidents → registre (SUGGESTION, jamais automatique) ────────────

export interface IncidentLite {
  riskItemId: string | null
  dateSurvenance: Date | string | null
  montantBrut: number | null
  recuperations: number | null
}

export interface RiskCalibration {
  /** Incidents rattachés au risque sur la fenêtre observée. */
  occurrences: number
  /** Somme des pertes nettes. */
  perteNetteTotale: number
  /** Vraisemblance suggérée (1-5) d'après la fréquence observée. */
  vraisemblanceSuggeree: number | null
}

/**
 * Propose une vraisemblance à partir de la fréquence d'incidents observée sur
 * `fenetreMois`. Barème (annualisé) : <1/an → 1 ; 1 → 2 ; 2-3 → 3 ; 4-11 → 4 ;
 * ≥12 → 5. C'est une SUGGESTION affichée au risk manager, jamais appliquée
 * d'office (décision produit : l'humain tranche).
 *
 * La suggestion cible la vraisemblance RÉSIDUELLE : un incident survenu l'a été
 * MALGRÉ les contrôles en place, la fréquence observée décrit donc l'exposition
 * actuelle, pas l'exposition brute.
 */
export function suggestCalibration(incidents: IncidentLite[], riskItemId: string, fenetreMois = 12): RiskCalibration {
  const lies = incidents.filter(i => i.riskItemId === riskItemId)
  const perteNetteTotale = lies.reduce((sum, i) => sum + (perteNette(i.montantBrut, i.recuperations) ?? 0), 0)
  const occurrences = lies.length
  if (occurrences === 0) {
    return { occurrences: 0, perteNetteTotale: 0, vraisemblanceSuggeree: null }
  }
  const parAn = occurrences * (12 / Math.max(1, fenetreMois))
  const vraisemblanceSuggeree = parAn >= 12 ? 5 : parAn >= 4 ? 4 : parAn >= 2 ? 3 : parAn >= 1 ? 2 : 1
  return { occurrences, perteNetteTotale: Math.round(perteNetteTotale * 100) / 100, vraisemblanceSuggeree }
}

// ─── Promotion d'un incident orphelin en risque du registre ──────────────────

export interface PromotableIncident {
  id: string
  intitule: string
  description: string | null
  taxonomieCode: string | null
  processusId: string | null
  entite: string | null
  impactEstime: number | null
  montantBrut: number | null
  recuperations: number | null
  riskItemId: string | null
}

export interface PromotedRisk {
  intitule: string
  description: string | null
  taxonomieCode: string | null
  processusId: string | null
  entite: string | null
  graviteResiduelle: number | null
  vraisemblanceResiduelle: number | null
  statut: string
  provenance: 'INCIDENT'
  sourceType: 'incident'
  sourceId: string
}

/** Vrai si l'incident peut être promu : pas déjà rattaché à un risque. */
export function estPromouvable(i: { riskItemId: string | null }): boolean {
  return !i.riskItemId
}

/**
 * Convertit un incident orphelin en risque du registre. L'impact ressenti
 * (échelle 1-4) sert de gravité résiduelle de départ, ramené sur l'échelle 1-5
 * du registre ; la vraisemblance résiduelle démarre à 1 (une occurrence connue),
 * à affiner ensuite par `suggestCalibration`. Le risque reste tracé vers son
 * incident d'origine (provenance INCIDENT).
 */
export function promoteToRisk(i: PromotableIncident): PromotedRisk {
  return {
    intitule: i.intitule,
    description: i.description,
    taxonomieCode: i.taxonomieCode,
    processusId: i.processusId,
    entite: i.entite,
    graviteResiduelle: i.impactEstime == null ? null : Math.min(5, Math.max(1, i.impactEstime)),
    vraisemblanceResiduelle: 1,
    statut: 'EVALUE',
    provenance: 'INCIDENT',
    sourceType: 'incident',
    sourceId: i.id,
  }
}
