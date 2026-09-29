// Champs JSON d'un incident nettoyé → valeurs acceptées par Prisma (cast unique, un seul endroit).
import type { Prisma } from '@prisma/client'
import type { CleanIncident } from './incident'

export const CHAMPS_JSON_INCIDENT = ['attributs', 'pertes', 'recuperationsLignes', 'chronologie', 'impactsNonFinanciers', 'allocations'] as const
type ChampJson = (typeof CHAMPS_JSON_INCIDENT)[number]

/** Sépare les champs JSON (castés) du reste des champs scalaires ; les clés absentes restent absentes. */
export function separerJson<T extends Partial<Pick<CleanIncident, ChampJson>>>(d: T): { json: Partial<Record<ChampJson, Prisma.InputJsonValue>>; reste: Omit<T, ChampJson> } {
  const json: Partial<Record<ChampJson, Prisma.InputJsonValue>> = {}
  const reste: Record<string, unknown> = { ...d }
  for (const k of CHAMPS_JSON_INCIDENT) {
    if (k in d && d[k] !== undefined) json[k] = d[k] as unknown as Prisma.InputJsonValue
    delete reste[k]
  }
  return { json, reste: reste as Omit<T, ChampJson> }
}
