// ─── Registre des dérogations : filtres, compteurs et tri (lot V1, pagination côté serveur) ──
// Règles de l'écran /derogations déplacées côté serveur (GET /api/derogations?page=…) : filtres
// par état effectif (actives, expirées, en revue, clôturées), recherche, tri. Compteurs des filtres
// calculés sur TOUT le registre visible.
import { etatDerogation, type DerogationEtat, type DerogationStatut } from '@/lib/derogation'
import { correspond, trier } from '@/lib/pagination'

export interface RegistreRow {
  id: string
  analyseId: string | null
  analyseNom: string | null
  portee: string
  referentiel: string | null
  ref: string | null
  intitule: string
  statut: string
  dateFin: string | null
}

// Fenêtre d'alerte par défaut pour l'affichage du registre (le seuil précis par
// organisation pilote les e-mails, pas cet aperçu).
export const ALERTE_DEFAUT_REGISTRE = 30

export const FILTRES_REGISTRE = ['EN_COURS_EXP', 'EN_COURS', 'EXPIREES', 'EN_REVUE', 'CLOTUREES'] as const
export type FiltreRegistre = (typeof FILTRES_REGISTRE)[number]
export const FILTRE_REGISTRE_DEFAUT: FiltreRegistre = 'EN_COURS_EXP'
export type CompteursRegistre = Record<FiltreRegistre, number>

const REVIEW = ['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER']
const TERMINAL = ['CLOTUREE', 'REJETEE', 'REVOQUEE', 'RETIREE']

/** Filtre lu dans l'URL ; valeur inconnue → filtre par défaut. */
export function lireFiltreRegistre(v: string | null | undefined): FiltreRegistre {
  return (FILTRES_REGISTRE as readonly string[]).includes(v ?? '') ? (v as FiltreRegistre) : FILTRE_REGISTRE_DEFAUT
}

/** État effectif d'une ligne (expiration calculée). */
export function etatLigne(r: { statut: string; dateFin: string | Date | null }, now: Date = new Date()): DerogationEtat {
  return etatDerogation({ statut: r.statut as DerogationStatut, dateFin: r.dateFin ? new Date(r.dateFin) : null }, ALERTE_DEFAUT_REGISTRE, now)
}

/** Prédicat d'appartenance d'une ligne (état effectif calculé) à un filtre. */
export function matchFiltre(f: FiltreRegistre, statut: string, etat: DerogationEtat): boolean {
  switch (f) {
    case 'EN_COURS_EXP': return etat === 'ACTIVE' || etat === 'EXPIRE_BIENTOT' || etat === 'EXPIREE'
    case 'EN_COURS':     return etat === 'ACTIVE' || etat === 'EXPIRE_BIENTOT'
    case 'EXPIREES':     return etat === 'EXPIREE'
    case 'EN_REVUE':     return REVIEW.includes(statut)
    case 'CLOTUREES':    return TERMINAL.includes(statut)
  }
}

/** Compteurs de chaque filtre (sur toutes les lignes fournies). */
export function compterParFiltre(rows: { statut: string; dateFin: string | Date | null }[], now: Date = new Date()): CompteursRegistre {
  const c = Object.fromEntries(FILTRES_REGISTRE.map(f => [f, 0])) as CompteursRegistre
  for (const r of rows) {
    const etat = etatLigne(r, now)
    for (const f of FILTRES_REGISTRE) if (matchFiltre(f, r.statut, etat)) c[f]++
  }
  return c
}

/** Compteurs mis à jour EN PLACE après une action sur une ligne (sans recharger le registre). */
export function ajusterCompteurs(c: CompteursRegistre, avant: { statut: string; dateFin: string | null }, apres: { statut: string; dateFin: string | null }, now: Date = new Date()): CompteursRegistre {
  const ea = etatLigne(avant, now)
  const ep = etatLigne(apres, now)
  return Object.fromEntries(FILTRES_REGISTRE.map(f => [f, c[f] - (matchFiltre(f, avant.statut, ea) ? 1 : 0) + (matchFiltre(f, apres.statut, ep) ? 1 : 0)])) as CompteursRegistre
}

/** Lignes d'un filtre + recherche (intitulé, analyse, référentiel, contrôle). */
export function filtrerRegistre<T extends RegistreRow>(rows: T[], f: { filtre: FiltreRegistre; q?: string }, now: Date = new Date()): T[] {
  return rows.filter(r => matchFiltre(f.filtre, r.statut, etatLigne(r, now)) && correspond(f.q ?? '', r.intitule, r.analyseNom, r.referentiel, r.ref))
}

export const TRIS_REGISTRE = ['defaut', 'intitule', 'analyse', 'etat', 'echeance'] as const
export type TriRegistre = (typeof TRIS_REGISTRE)[number]

/** Tri demandé ; `defaut` conserve l'ordre de la requête (statut, échéance, création). */
export function trierRegistre<T extends RegistreRow>(rows: T[], tri: TriRegistre, ordre: 'asc' | 'desc', now: Date = new Date()): T[] {
  if (tri === 'defaut') return rows
  const cle: Record<Exclude<TriRegistre, 'defaut'>, (r: T) => unknown> = {
    intitule: r => r.intitule, analyse: r => r.analyseNom, etat: r => etatLigne(r, now), echeance: r => (r.dateFin ? new Date(r.dateFin) : null),
  }
  return trier(rows, cle[tri], ordre)
}
