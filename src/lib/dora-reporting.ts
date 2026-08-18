// ─── Reporting réglementaire — Déclaration d'incident TIC majeur (DORA art. 19) ──
// Au-dessus de la CLASSIFICATION (lib/dora.ts), ce moteur gère le WORKFLOW de
// déclaration à l'autorité compétente : trois phases (notification initiale,
// rapport intermédiaire, rapport final) avec leurs ÉCHÉANCES et leur statut.
//
// Délais (paramétrables) alignés sur DORA + ses RTS/ITS de reporting :
//   - initiale     : ≤ 4 h après classification « majeur » ET ≤ 24 h après détection
//                    → l'échéance retenue est la PLUS TÔT (les deux contraintes valent) ;
//   - intermédiaire: ≤ 72 h après la notification initiale ;
//   - finale       : ≤ 1 mois (≈ 30 j) après la notification initiale.
//
// Ne s'applique QU'AUX incidents MAJEURS. Outil d'aide à la décision — ne vaut pas
// obligation réglementaire officielle. Logique PURE et testée.

import { classifierIncident, DORA_SEUILS_DEFAUT, type DoraClasse, type DoraCriteres, type DoraSeuils } from './dora'

export const DORA_PHASES = ['INITIALE', 'INTERMEDIAIRE', 'FINALE'] as const
export type DoraPhase = (typeof DORA_PHASES)[number]

export type DoraPhaseStatut = 'INAPPLICABLE' | 'SOUMIS' | 'EN_RETARD' | 'A_FAIRE'

export interface DoraDelaisConfig {
  /** Délai max après la classification « majeur » pour la notification initiale (heures). */
  initialeApresClassifH: number
  /** Plafond absolu après la détection pour la notification initiale (heures). */
  initialeApresDetectionH: number
  /** Délai du rapport intermédiaire après la notification initiale (heures). */
  intermediaireApresInitialeH: number
  /** Délai du rapport final après la notification initiale (jours). */
  finaleApresInitialeJours: number
}

export const DORA_DELAIS_DEFAUT: DoraDelaisConfig = {
  initialeApresClassifH: 4,
  initialeApresDetectionH: 24,
  intermediaireApresInitialeH: 72,
  finaleApresInitialeJours: 30,
}

export interface DoraReportingInput {
  classe?: DoraClasse | null
  dateDetection?: Date | string | null
  /** Moment où l'incident a été classé « majeur ». */
  dateClassification?: Date | string | null
  initialeSoumiseLe?: Date | string | null
  intermediaireSoumiseLe?: Date | string | null
  finaleSoumiseLe?: Date | string | null
}

export interface DoraEcheance {
  phase: DoraPhase
  /** Échéance calculée, ou null si les dates ne permettent pas de la déterminer. */
  echeance: Date | null
  statut: DoraPhaseStatut
  soumiseLe: Date | null
}

const H = 3_600_000
const J = 86_400_000

function parseDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Planifie les trois phases de déclaration d'un incident TIC pour DORA art. 19.
 * Renvoie toujours les trois phases (dans l'ordre), avec échéance et statut.
 */
export function planifierDeclarationDora(
  input: DoraReportingInput,
  maintenant: Date = new Date(),
  cfg: DoraDelaisConfig = DORA_DELAIS_DEFAUT,
): DoraEcheance[] {
  const estMajeur = input.classe === 'MAJEUR'
  const detection = parseDate(input.dateDetection)
  const classification = parseDate(input.dateClassification)
  const initSoumise = parseDate(input.initialeSoumiseLe)
  const interSoumise = parseDate(input.intermediaireSoumiseLe)
  const finaleSoumise = parseDate(input.finaleSoumiseLe)

  // Échéance initiale = la PLUS TÔT des contraintes disponibles (les deux valent).
  const bornes: number[] = []
  if (classification) bornes.push(classification.getTime() + cfg.initialeApresClassifH * H)
  if (detection) bornes.push(detection.getTime() + cfg.initialeApresDetectionH * H)
  const initEcheance = estMajeur && bornes.length ? new Date(Math.min(...bornes)) : null

  // Base des phases suivantes : la soumission initiale si faite, sinon son échéance.
  const base = initSoumise ?? initEcheance
  const interEcheance = estMajeur && base ? new Date(base.getTime() + cfg.intermediaireApresInitialeH * H) : null
  const finaleEcheance = estMajeur && base ? new Date(base.getTime() + cfg.finaleApresInitialeJours * J) : null

  const build = (phase: DoraPhase, echeance: Date | null, soumiseLe: Date | null): DoraEcheance => {
    let statut: DoraPhaseStatut
    if (!estMajeur) statut = 'INAPPLICABLE'
    else if (soumiseLe) statut = 'SOUMIS'
    else if (echeance && maintenant.getTime() > echeance.getTime()) statut = 'EN_RETARD'
    else statut = 'A_FAIRE'
    return { phase, echeance: estMajeur ? echeance : null, statut, soumiseLe }
  }

  return [
    build('INITIALE', initEcheance, initSoumise),
    build('INTERMEDIAIRE', interEcheance, interSoumise),
    build('FINALE', finaleEcheance, finaleSoumise),
  ]
}

export interface DoraReportingSynthese {
  /** Vrai si la déclaration s'applique (incident majeur). */
  applicable: boolean
  /** Prochaine échéance NON soumise encore à venir, ou null. */
  prochaineEcheance: Date | null
  enRetard: number
  soumises: number
}

/** Synthèse de pilotage à partir des phases planifiées. */
export function synthetiserDeclarationDora(
  echeances: DoraEcheance[],
  maintenant: Date = new Date(),
): DoraReportingSynthese {
  const applicable = echeances.some(e => e.statut !== 'INAPPLICABLE')
  const enRetard = echeances.filter(e => e.statut === 'EN_RETARD').length
  const soumises = echeances.filter(e => e.statut === 'SOUMIS').length

  const aVenir = echeances
    .filter(e => e.statut !== 'INAPPLICABLE' && e.statut !== 'SOUMIS' && e.echeance && e.echeance.getTime() >= maintenant.getTime())
    .map(e => e.echeance as Date)
    .sort((a, b) => a.getTime() - b.getTime())

  return { applicable, prochaineEcheance: aVenir[0] ?? null, enRetard, soumises }
}

// ─── Pont depuis un incident enregistré ──────────────────────────────────────
// Relie la CLASSIFICATION (lib/dora.ts) au WORKFLOW : à partir des critères DORA
// et des horodatages stockés sur l'incident, calcule la classe puis planifie les
// phases. Point unique consommé par l'API/l'UI du module incidents.

export interface IncidentReportingRecord {
  doraCriteres?: DoraCriteres | null
  dateDetection?: Date | string | null
  /** Horodatage de classification « majeur » (démarre l'horloge des 4 h). */
  doraClasseMajeurLe?: Date | string | null
  doraInitialeSoumiseLe?: Date | string | null
  doraIntermediaireSoumiseLe?: Date | string | null
  doraFinaleSoumiseLe?: Date | string | null
}

export interface IncidentReporting {
  classe: DoraClasse
  echeances: DoraEcheance[]
  synthese: DoraReportingSynthese
}

export function evaluerReportingIncident(
  rec: IncidentReportingRecord,
  maintenant: Date = new Date(),
  seuils: DoraSeuils = DORA_SEUILS_DEFAUT,
  cfg: DoraDelaisConfig = DORA_DELAIS_DEFAUT,
): IncidentReporting {
  const classe = classifierIncident(rec.doraCriteres ?? {}, seuils).classe
  const echeances = planifierDeclarationDora({
    classe,
    dateDetection: rec.dateDetection,
    dateClassification: rec.doraClasseMajeurLe,
    initialeSoumiseLe: rec.doraInitialeSoumiseLe,
    intermediaireSoumiseLe: rec.doraIntermediaireSoumiseLe,
    finaleSoumiseLe: rec.doraFinaleSoumiseLe,
  }, maintenant, cfg)
  return { classe, echeances, synthese: synthetiserDeclarationDora(echeances, maintenant) }
}
