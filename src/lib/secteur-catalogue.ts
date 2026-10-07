// ─── Secteur d'une analyse → secteurs du catalogue GRC (PUR) ──────────────────
// Le secteur d'une analyse est un libellé traduit (SECTEURS_ACTIVITE, même ordre dans les 5 langues) ; le catalogue
// sectoriel (lib/sector-suggestions) a ses propres codes. L'assurance, qui relève de « Banque / Finance » dans
// l'analyse, s'ajoute par le sous-secteur (assurance / mutuelle, complémentaire santé). Testé : secteur-catalogue.test.ts.
import { SECTEURS_ACTIVITE } from '@/lib/ebios-data'
import { getEbiosData } from '@/lib/ebios-data-i18n'
import { LOCALES } from '@/lib/i18n'
import type { SectorCode } from '@/lib/sector-suggestions'

const CODES: Record<string, SectorCode[]> = {
  'Administration publique': ['PUBLIC'], 'Banque / Finance': ['FINANCE'], 'Défense / Sécurité nationale': ['DEFENSE'],
  'Éducation / Recherche': ['EDUCATION'], 'Énergie / Utilities': ['ENERGIE'], 'Industrie / Manufacturing': ['INDUSTRIE'],
  'Informatique / Numérique': ['SAAS'], 'Santé / Médico-social': ['SANTE'], 'Télécommunications': ['TELECOM'],
  'Transports / Logistique': ['TRANSPORT'], 'Commerce / Distribution': ['COMMERCE'],
  'Professions juridiques / Cabinet d\'avocats': ['SERVICES'], 'E-commerce / Marketplace': ['COMMERCE'],
  'Agriculture / Agroalimentaire': ['AGRICOLE'], 'Immobilier / Construction': ['IMMOBILIER'], 'Médias / Culture': ['MEDIA'],
  'Eau / Assainissement': ['ENERGIE'], 'Tourisme / Hôtellerie-restauration': ['TOURISME'], 'Associations / ESS': ['ASSOCIATIONS'],
  'Protection sociale / Sécurité sociale': ['PROTECTION_SOCIALE'],
}
const SOUS_SECTEURS_ASSURANCE = new Set(['banque-assurance', 'sante-amc'])

/** Libellé français canonique d'un secteur saisi dans n'importe quelle langue. */
function canonique(secteur: string): string | null {
  for (const l of LOCALES) {
    const i = (getEbiosData(l).SECTEURS_ACTIVITE as readonly string[]).indexOf(secteur)
    if (i >= 0) return SECTEURS_ACTIVITE[i] ?? null
  }
  return null
}

export function codesCatalogueSecteur(secteur: string | null | undefined, sousSecteurs: readonly string[] = []): SectorCode[] {
  const fr = secteur ? canonique(secteur.trim()) : null
  const codes = [...(fr ? CODES[fr] ?? [] : [])]
  if (codes.length && sousSecteurs.some(s => SOUS_SECTEURS_ASSURANCE.has(s)) && !codes.includes('ASSURANCE')) codes.push('ASSURANCE')
  return codes
}
