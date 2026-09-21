// ─── Socle GRC — M2 : consolidation (roll-up) de la posture risque + action ──
// Agrège le registre et les plans d'action d'un SOUS-ARBRE d'organisations pour
// une vue « direction / groupe » : total consolidé + ventilation par entité.
// Logique PURE (réutilise les seuils cartographie et la synthèse d'action).

import { niveauBucket } from './cartographie'
import { summarizeActions, type ActionLike, type ActionsSummary } from './risk-action'

/** Palier de posture d'un risque pour la consolidation : élevé, moyen, faible ou non coté. */
export type PostureBucket = 'eleve' | 'moyen' | 'faible' | 'nonCote'

/** Vue minimale d'un risque pour le roll-up (org + cotation), sans les détails. */
export interface RiskLite {
  organizationId: string
  niveauInherent: number | null
  niveauResiduel: number | null
}

// Palier de posture d'un risque : basé sur le RÉSIDUEL s'il est coté, sinon
// l'inhérent, sinon « non coté ». (Le résiduel reflète l'exposition réelle.)
export function postureBucket(r: RiskLite): PostureBucket {
  const niveau = r.niveauResiduel ?? r.niveauInherent
  if (niveau == null) return 'nonCote'
  return niveauBucket(niveau)
}

/** Totaux de posture risque : total + répartition par palier (élevé/moyen/faible/non coté). */
export interface RiskTotals {
  total: number
  eleve: number
  moyen: number
  faible: number
  nonCote: number
}

/** Consolide la posture risque : total + répartition par palier (élevé/moyen/faible/non coté). */
export function rollupRisks(risks: RiskLite[]): RiskTotals {
  const t: RiskTotals = { total: risks.length, eleve: 0, moyen: 0, faible: 0, nonCote: 0 }
  for (const r of risks) t[postureBucket(r)]++
  return t
}

/** Vue minimale d'une organisation (id + nom) pour la consolidation. */
export interface OrgLite { id: string; nom: string }
/** Action de traitement rattachée à une organisation (pour ventiler par org). */
export interface ScopedAction extends ActionLike { organizationId: string }

/** Posture consolidée d'une organisation : totaux risques + avancement des actions. */
export interface OrgPosture {
  orgId: string
  orgNom: string
  risques: RiskTotals
  actions: ActionsSummary
}

// Ventile la posture PAR organisation (chaque entité avec ses propres risques et
// actions), triée du plus exposé au moins exposé : risques élevés, puis actions
// en retard, puis volume. Une organisation sans risque n'apparaît pas.
export function rollupByOrg(orgs: OrgLite[], risks: RiskLite[], actions: ScopedAction[], now: Date): OrgPosture[] {
  const nom = new Map(orgs.map(o => [o.id, o.nom]))
  const risksByOrg = new Map<string, RiskLite[]>()
  for (const r of risks) {
    const arr = risksByOrg.get(r.organizationId) ?? []
    arr.push(r); risksByOrg.set(r.organizationId, arr)
  }
  const actionsByOrg = new Map<string, ScopedAction[]>()
  for (const a of actions) {
    const arr = actionsByOrg.get(a.organizationId) ?? []
    arr.push(a); actionsByOrg.set(a.organizationId, arr)
  }

  const rows: OrgPosture[] = []
  for (const [orgId, orgRisks] of risksByOrg) {
    rows.push({
      orgId,
      orgNom: nom.get(orgId) ?? orgId,
      risques: rollupRisks(orgRisks),
      actions: summarizeActions(actionsByOrg.get(orgId) ?? [], now),
    })
  }
  return rows.sort((a, b) =>
    b.risques.eleve - a.risques.eleve ||
    b.actions.enRetard - a.actions.enRetard ||
    b.risques.total - a.risques.total ||
    a.orgNom.localeCompare(b.orgNom),
  )
}
