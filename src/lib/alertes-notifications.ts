/**
 * alertes-notifications.ts — Relances des déclarations à faire pour les régimes de notification (NIS2, CRA, RGPD, SEC, NYDFS,
 * HIPAA, internes et personnalisés). Module PUR. Pendant de `alertes-dora.ts` (qui garde le moteur DORA art. 19).
 *
 * Pour chaque phase non soumise dont l'échéance est connue :
 *  - A_FAIRE : alerte quand il reste moins d'un QUART du délai de la phase (au moins 6 h, au plus 7 jours) — ainsi l'alerte précoce de
 *    24 h est relancée à 6 h de l'échéance et le rapport final d'un mois une semaine avant ;
 *  - EN_RETARD : alerte au dépassement.
 * Chaque alerte n'est envoyée qu'une fois : clé `REGIME:PHASE:STATUT` mémorisée dans `Incident.alertesDora` (les clés DORA
 * `PHASE:STATUT` n'ont que deux segments, aucune collision).
 */
import type { HorlogeRegime } from './notification-regimes'

const H = 3_600_000
export const FENETRE_MIN_H = 6
export const FENETRE_MAX_H = 7 * 24

export interface AlerteRegime {
  regime: string; phase: string; statut: 'A_FAIRE' | 'EN_RETARD'; echeance: Date; cle: string
  regimeLabelKey?: string; regimeLabel?: string; phaseLabelKey?: string; phaseLabel?: string
}

export function fenetreAnticipationH(dureeH: number): number {
  return Math.min(FENETRE_MAX_H, Math.max(FENETRE_MIN_H, dureeH / 4))
}

export function alertesRegimesDues(horloges: HorlogeRegime[], deja: unknown, now: Date): AlerteRegime[] {
  const envoyees = deja && typeof deja === 'object' && !Array.isArray(deja) ? (deja as Record<string, unknown>) : {}
  const out: AlerteRegime[] = []
  for (const r of horloges) {
    for (const p of r.phases) {
      if (!p.echeance || (p.statut !== 'A_FAIRE' && p.statut !== 'EN_RETARD')) continue
      if (p.statut === 'A_FAIRE') {
        const dureeH = p.ancre ? (p.echeance.getTime() - p.ancre.getTime()) / H : FENETRE_MAX_H
        if (p.echeance.getTime() - now.getTime() > fenetreAnticipationH(dureeH) * H) continue
      }
      const cle = `${r.regime}:${p.code}:${p.statut}`
      if (envoyees[cle]) continue
      out.push({
        regime: r.regime, phase: p.code, statut: p.statut, echeance: p.echeance, cle,
        ...(r.labelKey ? { regimeLabelKey: r.labelKey } : {}), ...(r.label ? { regimeLabel: r.label } : {}),
        ...(p.labelKey ? { phaseLabelKey: p.labelKey } : {}), ...(p.label ? { phaseLabel: p.label } : {}),
      })
    }
  }
  return out
}
