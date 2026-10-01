/**
 * alertes-dora.ts — Alertes URGENTES de déclaration des incidents majeurs (DORA art. 19). Module PUR.
 * Les délais se comptent en heures : le cron `alertes-dora` tourne toutes les heures et envoie un
 * e-mail dédié (hors synthèse quotidienne). Pour chaque phase non soumise d'un incident majeur :
 *  - A_FAIRE : alerte quand l'échéance entre dans la fenêtre d'anticipation de la phase
 *    (notification initiale : dès qu'elle est due ; rapport intermédiaire : 24 h ; rapport final : 7 j) ;
 *  - EN_RETARD : alerte au dépassement.
 * Chaque alerte n'est envoyée qu'une fois (`Incident.alertesDora` : { "PHASE:STATUT": iso }).
 */
import type { DoraEcheance, DoraPhase } from './dora-reporting'

const H = 3_600_000
/** Fenêtre d'anticipation par phase (heures avant l'échéance) ; Infinity = dès que la phase est due. */
export const ANTICIPATION_DORA_H: Record<DoraPhase, number> = { INITIALE: Infinity, INTERMEDIAIRE: 24, FINALE: 7 * 24 }

export interface AlerteDora { phase: DoraPhase; statut: 'A_FAIRE' | 'EN_RETARD'; echeance: Date; cle: string }

export function alertesDoraDues(echeances: DoraEcheance[], deja: unknown, now: Date): AlerteDora[] {
  const envoyees = deja && typeof deja === 'object' && !Array.isArray(deja) ? (deja as Record<string, unknown>) : {}
  const out: AlerteDora[] = []
  for (const e of echeances) {
    if (!e.echeance || (e.statut !== 'A_FAIRE' && e.statut !== 'EN_RETARD')) continue
    if (e.statut === 'A_FAIRE' && e.echeance.getTime() - now.getTime() > ANTICIPATION_DORA_H[e.phase] * H) continue
    const cle = `${e.phase}:${e.statut}`
    if (envoyees[cle]) continue
    out.push({ phase: e.phase, statut: e.statut, echeance: e.echeance, cle })
  }
  return out
}
