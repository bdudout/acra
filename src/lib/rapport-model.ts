/**
 * rapport-model.ts — Modèle des rapports GRC (lot L2). Module PUR.
 *
 * Un rapport est produit sous forme d'ÉDITION FIGÉE : contenu structuré (sections de
 * blocs) calculé pour une période, stocké tel quel et jamais recalculé après validation.
 * Les libellés statiques sont des CLÉS i18n (`{ k: '…' }`) résolues à l'affichage dans la
 * langue du lecteur ; les libellés issus des données (catégories, entités…) sont résolus
 * à la génération. Cycle : brouillon → relu → validé → diffusé, avec quatre-yeux.
 */

export const RAPPORT_CODES = ['R-INC-1', 'R-PER-2', 'R-GRC-3', 'R-CTL-1', 'R-CTL-2', 'R-CTL-3'] as const
export type RapportCode = (typeof RAPPORT_CODES)[number]

export const RAPPORT_STATUTS = ['BROUILLON', 'RELU', 'VALIDE', 'DIFFUSE'] as const
export type RapportStatut = (typeof RAPPORT_STATUTS)[number]

/** Cellule de tableau : texte/nombre, ou clé i18n à résoudre à l'affichage. */
export type Cellule = string | number | null | { k: string }
export interface Kpi { cle: string; valeur: number | string; alerte?: boolean; unite?: 'devise' | 'jours' | 'pct' }
export type Bloc =
  | { type: 'kpis'; items: Kpi[] }
  | { type: 'tableau'; titre?: string; colonnes: string[]; lignes: Cellule[][] }
  | { type: 'texte'; cle: string }
export interface RapportSection { id: string; blocs: Bloc[] }
export interface RapportContenu {
  code: RapportCode
  periode: { debut: string; fin: string }
  genereLe: string
  deviseReference: string
  sections: RapportSection[]
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

export interface ModulesRapport { incidentsActive?: boolean; registreRisquesActive?: boolean; controlePermanentActive?: boolean; auditInterneActive?: boolean; kriActive?: boolean; reglementaireActive?: boolean; profilsOperationnelsActive?: boolean }
export interface RapportDef { code: RapportCode; module: 'incidents' | 'grc' | 'controle'; destinataires: string }

export const RAPPORT_CATALOGUE: RapportDef[] = [
  { code: 'R-INC-1', module: 'incidents', destinataires: 'Direction, RSSI' },
  { code: 'R-PER-2', module: 'incidents', destinataires: 'Comité des risques' },
  { code: 'R-GRC-3', module: 'grc', destinataires: 'Direction générale, conseil' },
  { code: 'R-CTL-1', module: 'controle', destinataires: 'Contrôle permanent, N2' },
  { code: 'R-CTL-2', module: 'controle', destinataires: 'Comité de contrôle interne' },
  { code: 'R-CTL-3', module: 'controle', destinataires: 'N2, direction' },
]

/** Rapports proposés selon les modules actifs (incidents pour R-INC/R-PER, un module GRC pour R-GRC). */
export function rapportsDisponibles(m: ModulesRapport): RapportDef[] {
  const grc = !!(m.registreRisquesActive || m.controlePermanentActive || m.auditInterneActive || m.kriActive || m.reglementaireActive || m.profilsOperationnelsActive)
  return RAPPORT_CATALOGUE.filter(r => (r.module === 'incidents' ? !!m.incidentsActive : r.module === 'controle' ? !!m.controlePermanentActive : grc))
}

// ─── Périodes ────────────────────────────────────────────────────────────────

export const PERIODE_PRESETS = ['MOIS_PRECEDENT', 'TRIMESTRE_PRECEDENT', 'ANNEE_COURS', 'ANNEE_PRECEDENTE'] as const
export type PeriodePreset = (typeof PERIODE_PRESETS)[number]
export interface Periode { debut: string; fin: string }

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)

/** Périodes usuelles (UTC, bornes incluses). */
export function periodePreset(p: PeriodePreset, now: Date): Periode {
  const y = now.getUTCFullYear(); const m = now.getUTCMonth()
  switch (p) {
    case 'MOIS_PRECEDENT': return { debut: iso(y, m - 1, 1), fin: iso(y, m, 0) }
    case 'TRIMESTRE_PRECEDENT': { const q = Math.floor(m / 3); return { debut: iso(y, (q - 1) * 3, 1), fin: iso(y, q * 3, 0) } }
    case 'ANNEE_COURS': return { debut: iso(y, 0, 1), fin: iso(y, 11, 31) }
    case 'ANNEE_PRECEDENTE': return { debut: iso(y - 1, 0, 1), fin: iso(y - 1, 11, 31) }
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_JOURS = 366 * 5

export function validerPeriode(p: { debut?: unknown; fin?: unknown }): 'periode_invalide' | 'periode_trop_longue' | null {
  if (typeof p.debut !== 'string' || typeof p.fin !== 'string' || !DATE_RE.test(p.debut) || !DATE_RE.test(p.fin)) return 'periode_invalide'
  const d = new Date(`${p.debut}T00:00:00Z`).getTime(); const f = new Date(`${p.fin}T00:00:00Z`).getTime()
  if (Number.isNaN(d) || Number.isNaN(f) || f < d) return 'periode_invalide'
  if ((f - d) / 86_400_000 > MAX_JOURS) return 'periode_trop_longue'
  return null
}

/** La période couvre `d` (bornes incluses, jour entier de fin). */
export function dansPeriode(d: Date | null, p: Periode): boolean {
  if (!d) return false
  return d.getTime() >= new Date(`${p.debut}T00:00:00Z`).getTime() && d.getTime() < new Date(`${p.fin}T00:00:00Z`).getTime() + 86_400_000
}

// ─── Cycle de validation ─────────────────────────────────────────────────────

const GRAPHE: Record<RapportStatut, RapportStatut[]> = {
  BROUILLON: ['RELU'], RELU: ['BROUILLON', 'VALIDE'], VALIDE: ['DIFFUSE'], DIFFUSE: [],
}

/**
 * Transition d'une édition. Quatre-yeux : quand la 2ᵉ ligne est active, le créateur ne
 * relit ni ne valide son propre rapport. En mode ligne unique, la validation directe
 * (brouillon → validé) et l'auto-validation sont permises (tracées par l'API).
 */
export function transitionRapport(
  depuis: RapportStatut, vers: RapportStatut,
  ctx: { acteur: string; createur: string; secondeLigneActive: boolean },
): { ok: true } | { ok: false; error: 'transition_interdite' | 'quatre_yeux' } {
  const directLigneUnique = !ctx.secondeLigneActive && depuis === 'BROUILLON' && vers === 'VALIDE'
  if (!GRAPHE[depuis].includes(vers) && !directLigneUnique) return { ok: false, error: 'transition_interdite' }
  if (ctx.secondeLigneActive && (vers === 'RELU' || vers === 'VALIDE') && ctx.acteur === ctx.createur) return { ok: false, error: 'quatre_yeux' }
  return { ok: true }
}

/** Seule une édition en brouillon peut être regénérée : une édition relue ou validée est figée. */
export function peutRegenerer(statut: RapportStatut): boolean {
  return statut === 'BROUILLON'
}
