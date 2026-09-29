/**
 * audit-rappels.ts — Rappels automatiques des recommandations d'audit (lot L4, suite). Module PUR :
 * décide quels constats méritent un rappel ; le cron envoie et marque `rappelLe` (anti-doublon).
 *  - ECHEANCE_PROCHE / EN_RETARD → l'audité (responsable de l'action) ;
 *  - A_VERIFIER (déclarée réalisée, en attente de vérification) → l'audit.
 * Un constat n'est relancé qu'au plus une fois par `rappelRelanceJours`.
 */

import type { AuditConfig } from './audit-config'

export interface ConstatRappel { id: string; statut: string; echeance: Date | null; rappelLe: Date | null; responsableAction: string | null }
export type TypeRappel = 'ECHEANCE_PROCHE' | 'EN_RETARD' | 'A_VERIFIER'
export interface Rappel { constatId: string; type: TypeRappel; destinataire: 'AUDITE' | 'AUDIT'; joursRestants: number | null }

const J = 86_400_000

export function calculerRappels(constats: ConstatRappel[], cfg: AuditConfig, now: Date): Rappel[] {
  if (!cfg.rappelsActifs) return []
  const out: Rappel[] = []
  for (const c of constats) {
    if (c.statut === 'VERIFIE' || c.statut === 'ACCEPTE') continue
    if (c.rappelLe && now.getTime() - c.rappelLe.getTime() < cfg.rappelRelanceJours * J) continue
    if (c.statut === 'RESOLU') { out.push({ constatId: c.id, type: 'A_VERIFIER', destinataire: 'AUDIT', joursRestants: null }); continue }
    if (!c.echeance) continue
    const jours = Math.ceil((c.echeance.getTime() - now.getTime()) / J)
    if (jours < 0) out.push({ constatId: c.id, type: 'EN_RETARD', destinataire: 'AUDITE', joursRestants: jours })
    else if (jours <= cfg.rappelJoursAvant) out.push({ constatId: c.id, type: 'ECHEANCE_PROCHE', destinataire: 'AUDITE', joursRestants: jours })
  }
  return out
}
