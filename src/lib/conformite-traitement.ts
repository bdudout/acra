/**
 * conformite-traitement.ts — Traitements RÉELS des écarts de conformité
 * (plan d'action, dérogation, acceptation de risque). Module PUR → testé.
 *
 * Un traitement (modèle ConformiteTraitement) couvre une ou plusieurs exigences
 * (`refs`) d'un référentiel. Il reste synchronisé avec l'étiquette portée par
 * l'entrée de conformité (ConformiteEntry.traitement) via `entryTagForType`.
 */
import type { ConformiteTraitement as EntryTag } from './conformite'

export type TraitementType = 'PLAN_ACTION' | 'DEROGATION' | 'ACCEPTATION_RISQUE'
export const TRAITEMENT_TYPES: TraitementType[] = ['PLAN_ACTION', 'DEROGATION', 'ACCEPTATION_RISQUE']
export const isTraitementType = (v: unknown): v is TraitementType =>
  typeof v === 'string' && (TRAITEMENT_TYPES as string[]).includes(v)

export type TraitementStatut = 'EN_COURS' | 'FAIT' | 'ACTIVE' | 'CLOTURE'
export const TRAITEMENT_STATUTS: TraitementStatut[] = ['EN_COURS', 'FAIT', 'ACTIVE', 'CLOTURE']

/** Étiquette portée par l'entrée de conformité correspondant à un type de traitement. */
export function entryTagForType(type: TraitementType): EntryTag {
  switch (type) {
    case 'PLAN_ACTION': return 'plan_action'
    case 'DEROGATION': return 'derogation'
    case 'ACCEPTATION_RISQUE': return 'acceptation_risque'
  }
}

/** Type de traitement correspondant à une étiquette d'entrée (inverse). */
export function typeForEntryTag(tag: EntryTag): TraitementType {
  switch (tag) {
    case 'plan_action': return 'PLAN_ACTION'
    case 'derogation': return 'DEROGATION'
    case 'acceptation_risque': return 'ACCEPTATION_RISQUE'
  }
}

/** Normalise une liste de refs de contrôles (chaînes non vides, uniques, bornées). */
export function sanitizeRefs(refs: unknown): string[] {
  if (!Array.isArray(refs)) return []
  const seen = new Set<string>()
  for (const r of refs) {
    const v = typeof r === 'string' ? r.trim().slice(0, 60) : ''
    if (v) seen.add(v)
  }
  return [...seen].slice(0, 500)
}
