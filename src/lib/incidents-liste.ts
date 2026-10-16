// ─── Registre des incidents : liste paginée côté serveur (lot V1) — PUR ────────────────────
// Règles reprises de l'écran (components/IncidentsManager) pour s'exécuter sur le serveur sur des lignes LÉGÈRES :
// filtre par statut (deep-link pilotage ?statut=), par entité du référentiel (lib/entites-filtre), filtres de colonnes
// (catégorie, processus, risques, statut), recherche, tri des colonnes. Les tuiles portent sur tous les incidents.
import { INCIDENT_STATUTS } from '@/lib/incident'
import { applyColumnFilters, type ColumnFilters } from '@/lib/table-filter'
import { correspond } from '@/lib/pagination'
import { clesDistinctes } from '@/lib/liste-colonnes'
import { mostFrequentString } from '@/lib/most-frequent'
import { filtrerParEntite } from '@/lib/entites-filtre'
import type { EntiteRef } from '@/lib/entites'

export const TRIS_INCIDENTS = ['defaut', 'incident', 'category', 'process', 'perte', 'risque', 'statut'] as const
export type TriIncident = (typeof TRIS_INCIDENTS)[number]
export const COLONNES_INCIDENTS = ['category', 'process', 'risque', 'statut'] as const

export interface IncidentLeger {
  id: string
  intitule: string
  statut: string
  taxonomieCode: string | null
  processusId: string | null
  processusNom: string | null
  entite: string | null
  entiteId: string | null
  dateSurvenance: Date | string | null
  dateDetection: Date | string | null
  perteNette: number | null
  /** Intitulés des risques associés, joints par « · » (libellé de la colonne Risques). */
  risquesTexte: string
}

/** Libellé de la colonne Risques (identique à l'écran). */
export function texteRisques(risques: readonly { intitule: string }[]): string {
  return risques.map(r => r.intitule).join(' · ')
}

/** Clé de filtre d'une colonne (code / nom / intitulés / statut ; '' = non renseigné). */
export function cleColonneIncident(i: IncidentLeger, col: string): string {
  switch (col) {
    case 'category': return i.taxonomieCode ?? ''
    case 'process': return i.processusNom ?? ''
    case 'risque': return i.risquesTexte
    case 'statut': return i.statut
    default: return ''
  }
}

/** Statut du deep-link (?statut=, sans casse) ; '' s'il est inconnu. */
export function lireStatut(v: string | null | undefined): string {
  const s = (v ?? '').toUpperCase()
  return (INCIDENT_STATUTS as readonly string[]).includes(s) ? s : ''
}

/** Base de la liste : statut puis entité (sous-entités comprises sauf demande contraire), comme l'écran. */
export function baseIncidents<T extends IncidentLeger>(rows: readonly T[], f: { statut: string; entite: string; sousEntites: boolean; entites: EntiteRef[] }): T[] {
  return filtrerParEntite(f.statut ? rows.filter(i => i.statut === f.statut) : [...rows], f.entites, f.entite, f.sousEntites)
}

/** Recherche + filtres de colonnes appliqués à la base. */
export function filtrerIncidents<T extends IncidentLeger>(base: readonly T[], f: { q: string; colonnes: ColumnFilters }): T[] {
  const cherches = f.q ? base.filter(i => correspond(f.q, i.intitule, i.entite, i.processusNom, i.risquesTexte)) : [...base]
  return applyColumnFilters(cherches, f.colonnes, cleColonneIncident)
}

const RANG_STATUT: Record<string, number> = Object.fromEntries(INCIDENT_STATUTS.map((s, i) => [s, i]))

/** Valeur de tri d'une colonne (null pour l'ordre par défaut : création décroissante). */
export function valeurTriIncident(tri: TriIncident): ((i: IncidentLeger) => unknown) | null {
  switch (tri) {
    case 'incident': return i => i.intitule
    // Catégorie : triée par code (le libellé est traduit à l'écran) ; les incidents d'une même catégorie restent groupés.
    case 'category': return i => i.taxonomieCode
    case 'process': return i => i.processusNom
    case 'perte': return i => i.perteNette
    case 'risque': return i => i.risquesTexte
    case 'statut': return i => RANG_STATUT[i.statut] ?? 99
    default: return null
  }
}

export interface SyntheseIncidents {
  /** Tous les incidents de l'organisation (tuile « Total »). */
  total: number
  /** Incidents à qualifier (statut DECLARE). */
  aQualifier: number
  /** Somme des pertes nettes (tous incidents). */
  perteNetteTotale: number
  /** Entité la plus saisie (valeur par défaut du formulaire de déclaration). */
  entiteFrequente: string
  /** Clés distinctes des colonnes filtrables, sur la base (après statut et entité). */
  valeurs: Record<(typeof COLONNES_INCIDENTS)[number], string[]>
}

export function syntheseIncidents(tous: readonly IncidentLeger[], base: readonly IncidentLeger[]): SyntheseIncidents {
  return {
    total: tous.length,
    aQualifier: tous.filter(i => i.statut === 'DECLARE').length,
    perteNetteTotale: tous.reduce((s, i) => s + (i.perteNette ?? 0), 0),
    entiteFrequente: mostFrequentString(tous.map(i => i.entite)),
    valeurs: {
      category: clesDistinctes(base, i => cleColonneIncident(i, 'category')),
      process: clesDistinctes(base, i => cleColonneIncident(i, 'process')),
      risque: clesDistinctes(base, i => cleColonneIncident(i, 'risque')),
      statut: clesDistinctes(base, i => cleColonneIncident(i, 'statut')),
    },
  }
}
