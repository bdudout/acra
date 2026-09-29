/**
 * rapport-direction.ts — R-GRC-3 : rapport « une page » pour la direction générale ou le
 * conseil : un voyant, cinq chiffres clés, trois décisions à prendre au plus. Module PUR.
 * Réutilise le verdict du dispositif du cockpit (`verdictDispositif`) : mêmes règles,
 * même lecture. Une donnée dont le module est inactif est omise (jamais inventée).
 */

import { verdictDispositif, verdictSignauxActifs, type VerdictSignaux, type ComiteConsolide, type ComiteModules } from './comite-pack'
import type { Periode, RapportContenu, Cellule } from './rapport-model'

export interface DirectionInput {
  consolide: ComiteConsolide
  modules: ComiteModules
  /** Incidents de la période (R-INC / R-PER) ; absent si le module incidents est inactif. */
  incidents?: { ouverts: number; perteNettePeriode: number; notifsEnRetard: number; grandesPertes: number }
  deviseReference: string
  periode: Periode
  now: Date
}

const CONFORMITE_SEUIL = 80
// Ordre de priorité des décisions : signaux de crise d'abord.
const ORDRE_DECISIONS = ['constatsCritiques', 'doraMajeurs', 'kriCritique', 'regulateurEchues', 'notifsEnRetard', 'grandesPertes', 'horsAppetit', 'conformiteSousSeuil', 'actionsEnRetard'] as const

export function buildRapportDirection(i: DirectionInput): RapportContenu {
  const c = i.consolide
  const signaux: VerdictSignaux = {
    constatsCritiques: c.audit?.critiques, doraMajeurs: c.dora?.majeurs, kriCritique: c.kri?.critique, regulateurEchues: c.regulateur?.echues,
    horsAppetit: c.appetit?.horsAppetit, actionsEnRetard: c.actions?.enRetard,
    conformiteSousSeuil: c.controles?.tauxConformite != null && c.controles.tauxConformite < CONFORMITE_SEUIL,
  }
  const verdict = verdictDispositif(signaux)
  const valeurs: Record<(typeof ORDRE_DECISIONS)[number], number> = {
    constatsCritiques: c.audit?.critiques ?? 0, doraMajeurs: c.dora?.majeurs ?? 0, kriCritique: c.kri?.critique ?? 0, regulateurEchues: c.regulateur?.echues ?? 0,
    notifsEnRetard: i.incidents?.notifsEnRetard ?? 0, grandesPertes: i.incidents?.grandesPertes ?? 0,
    horsAppetit: c.appetit?.horsAppetit ?? 0, conformiteSousSeuil: c.controles?.tauxConformite ?? 0, actionsEnRetard: c.actions?.enRetard ?? 0,
  }
  const actifs = new Set<string>([...verdictSignauxActifs(signaux), ...((i.incidents?.notifsEnRetard ?? 0) > 0 ? ['notifsEnRetard'] : []), ...((i.incidents?.grandesPertes ?? 0) > 0 ? ['grandesPertes'] : [])])
  const decisions: Cellule[][] = ORDRE_DECISIONS.filter(k => actifs.has(k)).slice(0, 3).map(k => [{ k: `rapports.decisions.${k}` }, valeurs[k]])

  const chiffres: { cle: string; valeur: number | string; alerte?: boolean; unite?: 'devise' | 'pct' }[] = []
  if (c.risques) chiffres.push({ cle: 'risquesEleves', valeur: c.risques.eleve, alerte: c.risques.eleve > 0 })
  if (c.actions) chiffres.push({ cle: 'actionsEnRetard', valeur: c.actions.enRetard, alerte: c.actions.enRetard > 0 })
  if (i.modules.incidents && i.incidents) {
    chiffres.push({ cle: 'incidentsOuverts', valeur: i.incidents.ouverts })
    chiffres.push({ cle: 'perteNette', valeur: i.incidents.perteNettePeriode, unite: 'devise' })
  }
  if (i.modules.controles && c.controles?.tauxConformite != null) chiffres.push({ cle: 'conformite', valeur: c.controles.tauxConformite, unite: 'pct' })

  return {
    code: 'R-GRC-3', periode: i.periode, genereLe: i.now.toISOString(), deviseReference: i.deviseReference,
    sections: [
      { id: 'voyant', blocs: [{ type: 'kpis', items: [{ cle: 'niveau', valeur: verdict.niveau, alerte: verdict.niveau !== 'MAITRISE' }, { cle: 'alertes', valeur: verdict.alertes }] }] },
      { id: 'chiffres', blocs: [{ type: 'kpis', items: chiffres }] },
      { id: 'decisions', blocs: [{ type: 'tableau', colonnes: ['rapports.cols.decision', 'rapports.cols.valeur'], lignes: decisions }] },
    ],
  }
}
