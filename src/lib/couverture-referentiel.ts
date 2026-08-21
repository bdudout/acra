// ─── Conformité dérivée : couverture d'un référentiel par les contrôles/audit ─
// Pour chaque exigence d'un référentiel, dérive un statut à partir des CONTRÔLES
// RÉELS qui la couvrent (leur efficacité observée) et des CONSTATS d'audit qui la
// visent — « conformité prouvée par les contrôles », pas seulement déclarée.
// Logique PURE et testée.

export type CouvertureStatut = 'NON_COUVERT' | 'CONFORME' | 'PARTIEL' | 'ANOMALIE'

export type Efficacite = 'FORTE' | 'MOYENNE' | 'FAIBLE' | null

export interface ControleCouvrant {
  exigenceRefs: string[]
  efficacite: Efficacite
  actif?: boolean
}

export interface ConstatExigence {
  exigenceRef: string | null
  statut: string // OUVERT | EN_COURS | RESOLU | ACCEPTE
}

export interface CouvertureExigence {
  ref: string
  statut: CouvertureStatut
  nbControles: number // contrôles actifs couvrant l'exigence
  nbAnomaliesAudit: number // constats non terminés visant l'exigence
}

export interface CouvertureSynthese {
  total: number
  couverts: number // exigences avec au moins un contrôle actif
  conformes: number
  anomalies: number
  nonCouverts: number
  tauxCouverture: number // % d'exigences couvertes
  tauxConformite: number // % d'exigences conformes
}

export interface Couverture {
  parExigence: CouvertureExigence[]
  synthese: CouvertureSynthese
}

const CONSTAT_TERMINES = new Set(['RESOLU', 'ACCEPTE'])

export function synthetiserCouverture(
  exigences: { ref: string }[],
  controles: ControleCouvrant[],
  constats: ConstatExigence[],
): Couverture {
  // Indexe les contrôles actifs par exigence couverte.
  const parExigenceControles = new Map<string, Efficacite[]>()
  for (const c of controles) {
    if (c.actif === false) continue
    for (const ref of c.exigenceRefs ?? []) {
      const arr = parExigenceControles.get(ref) ?? []
      arr.push(c.efficacite)
      parExigenceControles.set(ref, arr)
    }
  }
  // Indexe les constats NON terminés par exigence.
  const parExigenceAnomalies = new Map<string, number>()
  for (const co of constats) {
    if (!co.exigenceRef || CONSTAT_TERMINES.has(co.statut)) continue
    parExigenceAnomalies.set(co.exigenceRef, (parExigenceAnomalies.get(co.exigenceRef) ?? 0) + 1)
  }

  const parExigence: CouvertureExigence[] = exigences.map(ex => {
    const effs = parExigenceControles.get(ex.ref) ?? []
    const nbAnomaliesAudit = parExigenceAnomalies.get(ex.ref) ?? 0

    let statut: CouvertureStatut
    if (nbAnomaliesAudit > 0) {
      statut = 'ANOMALIE' // un constat d'audit ouvert prime : non-conformité avérée
    } else if (effs.length === 0) {
      statut = 'NON_COUVERT'
    } else if (effs.some(e => e === 'FAIBLE')) {
      statut = 'ANOMALIE'
    } else if (effs.every(e => e === 'FORTE')) {
      statut = 'CONFORME'
    } else {
      statut = 'PARTIEL' // MOYENNE, ou contrôle pas encore évalué (null)
    }

    return { ref: ex.ref, statut, nbControles: effs.length, nbAnomaliesAudit }
  })

  const total = parExigence.length
  const couverts = parExigence.filter(e => e.statut !== 'NON_COUVERT').length
  const conformes = parExigence.filter(e => e.statut === 'CONFORME').length
  const anomalies = parExigence.filter(e => e.statut === 'ANOMALIE').length
  const nonCouverts = parExigence.filter(e => e.statut === 'NON_COUVERT').length
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  return {
    parExigence,
    synthese: { total, couverts, conformes, anomalies, nonCouverts, tauxCouverture: pct(couverts), tauxConformite: pct(conformes) },
  }
}
