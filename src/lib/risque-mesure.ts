// ─── Mesure de sécurité rattachée à un risque (saisie directe) — module PUR ──
// Pour les méthodes à saisie directe, on documente les MESURES existantes (contrôles
// en place) qui expliquent la réduction du risque BRUT → ACTUEL. Réutilise le modèle
// `Mesure` (champ `risqueId`). Ce module assainit l'entrée (nom + type + efficacité) ;
// une mesure existante est par défaut au statut RÉALISÉ. Sans DB → testé unitairement.

import { clampInt } from '@/lib/import-sanitize'

/** Types de mesure (enum Prisma TypeMesure). */
export const MESURE_TYPES = ['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'DISSUASIVE', 'ORGANISATIONNELLE', 'TECHNIQUE'] as const
export type MesureType = (typeof MESURE_TYPES)[number]

/** Statuts de mesure (enum Prisma StatutMesure). */
export const MESURE_STATUTS = ['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE'] as const
export type MesureStatut = (typeof MESURE_STATUTS)[number]

/** Mesure rattachée à un risque, assainie. */
export interface RiskMesurePayload {
  nom: string
  type: MesureType
  statut: MesureStatut
  efficacite?: number
  description?: string
}

/**
 * Assainit une mesure rattachée à un risque : nom borné, type normalisé (défaut
 * PREVENTIVE), statut normalisé (défaut RÉALISÉ — une mesure existante est en place),
 * efficacité bornée à [1,4]. Ne fait jamais confiance aux entrées.
 */
export function sanitizeRiskMesure(input: unknown): RiskMesurePayload {
  const o = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const type: MesureType = MESURE_TYPES.includes(String(o.type) as MesureType) ? (String(o.type) as MesureType) : 'PREVENTIVE'
  const statut: MesureStatut = MESURE_STATUTS.includes(String(o.statut) as MesureStatut) ? (String(o.statut) as MesureStatut) : 'REALISE'
  return {
    nom: String(o.nom ?? '').slice(0, 255),
    type,
    statut,
    ...(o.efficacite != null ? { efficacite: clampInt(o.efficacite, 1, 4, 2) as number } : {}),
    ...(o.description != null ? { description: String(o.description).slice(0, 2000) } : {}),
  }
}

/** Vrai si la mesure est exploitable (un intitulé est requis). */
export function isRiskMesureValid(p: RiskMesurePayload): boolean {
  return p.nom.trim().length > 0
}

/** Champs Prisma renvoyés pour une mesure rattachée à un risque (module non-route). */
export const RISK_MESURE_SELECT = { id: true, nom: true, type: true, statut: true, efficacite: true, description: true } as const
