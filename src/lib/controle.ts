// ─── Module M3 — Contrôle permanent ──────────────────────────────────────────
// Bibliothèque de contrôles rattachés à la maille (risque / processus), exécutés
// périodiquement : la 1ʳᵉ ligne exécute (niveau 1), la 2ᵉ ligne supervise
// (niveau 2). Chaque exécution est CONFORME, en ANOMALIE ou NON_APPLICABLE ;
// le taux de conformité observé alimente l'efficacité du contrôle, qui suggère
// une vraisemblance résiduelle (boucle RCSA). Logique PURE et testée.

export const CONTROLE_NIVEAUX = ['N1', 'N2'] as const
export type ControleNiveau = (typeof CONTROLE_NIVEAUX)[number]

export const PERIODICITES = ['MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL'] as const
export type Periodicite = (typeof PERIODICITES)[number]

export const RESULTATS = ['CONFORME', 'ANOMALIE', 'NON_APPLICABLE'] as const
export type Resultat = (typeof RESULTATS)[number]

/** Nombre d'exécutions attendues par an, par périodicité. */
export const OCCURRENCES_PAR_AN: Record<Periodicite, number> = {
  MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1,
}

const MOIS_PAR_PERIODE: Record<Periodicite, number> = {
  MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12,
}

// ─── Entrées ─────────────────────────────────────────────────────────────────

export interface ControleInput {
  intitule?: unknown
  description?: unknown
  niveau?: unknown
  periodicite?: unknown
  responsable?: unknown
  riskItemId?: unknown
  processusId?: unknown
  tailleEchantillon?: unknown
  actif?: unknown
}

export interface CleanControle {
  intitule: string
  description: string | null
  niveau: ControleNiveau
  periodicite: Periodicite
  responsable: string | null
  riskItemId: string | null
  processusId: string | null
  tailleEchantillon: number | null
  actif: boolean
}

const txt = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

/** Renvoie un code d'erreur i18n, ou null si l'entrée est valide. */
export function validateControleInput(body: ControleInput): string | null {
  if (typeof body.intitule !== 'string' || body.intitule.trim() === '') return 'intitule_requis'
  if (body.niveau != null && !CONTROLE_NIVEAUX.includes(body.niveau as ControleNiveau)) return 'niveau_invalide'
  if (body.periodicite != null && !PERIODICITES.includes(body.periodicite as Periodicite)) return 'periodicite_invalide'
  if (body.tailleEchantillon != null && body.tailleEchantillon !== '') {
    const n = Number(body.tailleEchantillon)
    if (!Number.isInteger(n) || n < 1) return 'echantillon_invalide'
  }
  return null
}

export function cleanControleInput(body: ControleInput): CleanControle {
  const niv = body.niveau as ControleNiveau
  const per = body.periodicite as Periodicite
  return {
    intitule: String(body.intitule).trim(),
    description: txt(body.description),
    niveau: CONTROLE_NIVEAUX.includes(niv) ? niv : 'N1',
    periodicite: PERIODICITES.includes(per) ? per : 'TRIMESTRIEL',
    responsable: txt(body.responsable),
    riskItemId: txt(body.riskItemId),
    processusId: txt(body.processusId),
    tailleEchantillon: body.tailleEchantillon == null || body.tailleEchantillon === ''
      ? null : Math.max(1, Math.round(Number(body.tailleEchantillon))),
    actif: body.actif === undefined ? true : body.actif !== false,
  }
}

export interface ExecutionInput {
  resultat?: unknown
  dateRealisation?: unknown
  constat?: unknown
  tailleTestee?: unknown
  anomaliesTrouvees?: unknown
}

export interface CleanExecution {
  resultat: Resultat
  dateRealisation: Date
  constat: string | null
  tailleTestee: number | null
  anomaliesTrouvees: number | null
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}

export function validateExecutionInput(body: ExecutionInput): string | null {
  if (!RESULTATS.includes(body.resultat as Resultat)) return 'resultat_invalide'
  if (body.dateRealisation != null && body.dateRealisation !== '' && parseDate(body.dateRealisation) == null) return 'date_invalide'
  for (const champ of ['tailleTestee', 'anomaliesTrouvees'] as const) {
    const v = body[champ]
    if (v != null && v !== '') {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0) return 'nombre_invalide'
    }
  }
  const testee = body.tailleTestee == null || body.tailleTestee === '' ? null : Number(body.tailleTestee)
  const anos = body.anomaliesTrouvees == null || body.anomaliesTrouvees === '' ? null : Number(body.anomaliesTrouvees)
  if (testee != null && anos != null && anos > testee) return 'anomalies_superieures'
  // Une anomalie constatée exige un constat écrit (traçabilité pour l'auditeur).
  if (body.resultat === 'ANOMALIE' && !txt(body.constat)) return 'constat_requis'
  return null
}

export function cleanExecutionInput(body: ExecutionInput, now: Date = new Date()): CleanExecution {
  return {
    resultat: body.resultat as Resultat,
    dateRealisation: parseDate(body.dateRealisation) ?? now,
    constat: txt(body.constat),
    tailleTestee: body.tailleTestee == null || body.tailleTestee === '' ? null : Math.max(0, Math.round(Number(body.tailleTestee))),
    anomaliesTrouvees: body.anomaliesTrouvees == null || body.anomaliesTrouvees === '' ? null : Math.max(0, Math.round(Number(body.anomaliesTrouvees))),
  }
}

// ─── Échéancier ──────────────────────────────────────────────────────────────

/** Ajoute `mois` mois à une date en bornant le jour au dernier jour du mois cible. */
function addMonths(d: Date, mois: number): Date {
  const jour = d.getUTCDate()
  const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mois, 1))
  const dernierJour = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate()
  cible.setUTCDate(Math.min(jour, dernierJour))
  return cible
}

/**
 * Prochaine échéance d'un contrôle : dernière exécution + une période, ou la
 * date de création + une période si le contrôle n'a jamais été exécuté.
 */
export function prochaineEcheance(periodicite: Periodicite, derniereExecution: Date | string | null, creeLe: Date | string): Date {
  const base = derniereExecution ? new Date(derniereExecution) : new Date(creeLe)
  return addMonths(base, MOIS_PAR_PERIODE[periodicite])
}

export type EtatEcheance = 'A_VENIR' | 'DU' | 'EN_RETARD'

/**
 * État d'échéance : EN_RETARD si dépassée, DU dans les `fenetreJours` qui
 * précèdent (défaut 7), sinon A_VENIR.
 */
export function etatEcheance(echeance: Date | string, now: Date = new Date(), fenetreJours = 7): EtatEcheance {
  const e = new Date(echeance).getTime()
  const t = now.getTime()
  if (e < t) return 'EN_RETARD'
  if (e - t <= fenetreJours * 86_400_000) return 'DU'
  return 'A_VENIR'
}

// ─── Efficacité observée (boucle RCSA) ───────────────────────────────────────

export interface ExecutionLite {
  resultat: string
  dateRealisation: Date | string
}

export interface ControleEfficacite {
  /** Exécutions retenues (NON_APPLICABLE exclues du calcul). */
  evaluees: number
  conformes: number
  anomalies: number
  /** Taux de conformité en % entier ; null si aucune exécution évaluable. */
  tauxConformite: number | null
  /** Efficacité qualitative dérivée du taux. */
  efficacite: 'FORTE' | 'MOYENNE' | 'FAIBLE' | null
  /** Vraisemblance résiduelle suggérée (1-5) d'après l'efficacité. */
  vraisemblanceSuggeree: number | null
}

/**
 * Efficacité d'un contrôle d'après ses exécutions. Les NON_APPLICABLE ne
 * comptent pas (le contrôle n'avait pas lieu de s'appliquer).
 * Barème : ≥95 % → FORTE (V1) ; ≥80 % → MOYENNE (V3) ; sinon FAIBLE (V5).
 * SUGGESTION destinée au risk manager, jamais appliquée d'office.
 */
export function evaluerEfficacite(executions: ExecutionLite[]): ControleEfficacite {
  const evaluables = executions.filter(e => e.resultat === 'CONFORME' || e.resultat === 'ANOMALIE')
  const conformes = evaluables.filter(e => e.resultat === 'CONFORME').length
  const anomalies = evaluables.length - conformes
  if (evaluables.length === 0) {
    return { evaluees: 0, conformes: 0, anomalies: 0, tauxConformite: null, efficacite: null, vraisemblanceSuggeree: null }
  }
  const taux = Math.round((conformes / evaluables.length) * 100)
  const efficacite = taux >= 95 ? 'FORTE' as const : taux >= 80 ? 'MOYENNE' as const : 'FAIBLE' as const
  const vraisemblanceSuggeree = efficacite === 'FORTE' ? 1 : efficacite === 'MOYENNE' ? 3 : 5
  return { evaluees: evaluables.length, conformes, anomalies, tauxConformite: taux, efficacite, vraisemblanceSuggeree }
}

/** Intitulé du plan d'action généré automatiquement sur anomalie. */
export function libelleActionAnomalie(intituleControle: string): string {
  return `Traiter l'anomalie : ${intituleControle}`
}
