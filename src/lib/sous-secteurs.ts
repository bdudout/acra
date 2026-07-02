/**
 * sous-secteurs.ts — Taxonomie des sous-secteurs (issue #25).
 *
 * Le secteur d'une analyse est stocké sous son libellé LOCALISÉ ; on rattache donc
 * un secteur à une « famille » par mots-clés multilingues (même approche que
 * `baseFrameworksForSector`). La famille permet de proposer les sous-secteurs
 * pertinents (cf. SOUS_SECTEURS dans ebios-data.ts) et d'affiner la guidance.
 *
 * Module pur → testé (sous-secteurs.test.ts).
 */
import { SOUS_SECTEURS } from '@/lib/ebios-data'

export type SecteurFamille = 'sante' | 'banque' | 'defense' | 'energie' | 'administration' | 'industrie' | 'juridique' | 'transport' | 'immobilier'

// Mots-clés (minuscules, sous-chaînes) par famille — ordre = priorité de résolution.
const FAMILY_KEYWORDS: { famille: SecteurFamille; kw: string[] }[] = [
  { famille: 'sante', kw: ['santé', 'sante', 'médico', 'medico', 'hospital', 'soin', 'health', 'salud', 'gesundheit', 'sanità', 'sanita'] },
  { famille: 'banque', kw: ['banque', 'bancaire', 'finance', 'financ', 'assur', 'fintech', 'bank', 'insurance', 'versicherung', 'seguro', 'assicura'] },
  { famille: 'defense', kw: ['défense', 'defense', 'défence', 'defence', 'militaire', 'verteidigung', 'defensa', 'difesa', 'national'] },
  { famille: 'energie', kw: ['énergie', 'energie', 'utilities', 'energy', 'energía', 'energia'] },
  { famille: 'administration', kw: ['administration', 'public', 'collectivit', 'gouvernement', 'government', 'verwaltung', 'amministrazione', 'état', 'etat'] },
  { famille: 'industrie', kw: ['industrie', 'manufactur', 'usine', 'scada', 'industry', 'industria', 'industrie '] },
  { famille: 'juridique', kw: ['juridique', 'avocat', 'notaire', 'juriste', 'barreau', 'legal', 'law', 'notar', 'abogado', 'anwalt'] },
  { famille: 'transport', kw: ['transport', 'logistique', 'logistics', 'fret', 'ferroviaire', 'aérien', 'aerien', 'maritime', 'livraison', 'transporte', 'trasporto', 'verkehr'] },
  { famille: 'immobilier', kw: ['immobilier', 'construction', 'bâtiment', 'batiment', 'btp', 'promoteur', 'real estate', 'foncier', 'inmobili', 'immobili', 'bau'] },
]

/** Famille d'un secteur (par mots-clés multilingues), ou null si aucune taxonomie. */
export function secteurFamily(secteur?: string | null): SecteurFamille | null {
  const s = (secteur ?? '').toLowerCase()
  if (!s) return null
  for (const { famille, kw } of FAMILY_KEYWORDS) {
    if (kw.some(k => s.includes(k))) return famille
  }
  return null
}

/** Ids de sous-secteurs proposés pour ce secteur (vide si aucune taxonomie). */
export function sousSecteurIdsFor(secteur?: string | null): string[] {
  const fam = secteurFamily(secteur)
  if (!fam) return []
  return SOUS_SECTEURS.filter(s => s.famille === fam).map(s => s.id)
}

/** Vrai si le sous-secteur appartient bien à la famille du secteur (cohérence). */
export function isSousSecteurOfSecteur(secteur?: string | null, sousSecteur?: string | null): boolean {
  if (!sousSecteur) return false
  return sousSecteurIdsFor(secteur).includes(sousSecteur)
}

// Sous-secteurs santé qui hébergent réellement les données (cibles directes HDS) :
// la mise en garde « HDS = auto-hébergement, préférez ISO 27001 » ne doit PAS leur
// être affichée (issue #78).
const HDS_SELF_HOSTING = new Set(['sante-hopital', 'sante-ehpad'])

/** Faut-il afficher la mise en garde HDS ? Non pour les hébergeurs (CHU/EHPAD). */
export function showsHdsCaveat(sousSecteur?: string | null): boolean {
  return !HDS_SELF_HOSTING.has(sousSecteur ?? '')
}
