import { describe, it, expect } from 'vitest'
import { secteurFamily, sousSecteurIdsFor, isSousSecteurOfSecteur } from '@/lib/sous-secteurs'

// Taxonomie des sous-secteurs (issue #25). Matching par mots-clés multilingue
// car le secteur est stocké sous son libellé localisé.

describe('secteurFamily', () => {
  it('reconnaît les familles à sous-secteurs (FR + autres langues)', () => {
    expect(secteurFamily('Santé / Médico-social')).toBe('sante')
    expect(secteurFamily('Healthcare')).toBe('sante')
    expect(secteurFamily('Banque / Finance')).toBe('banque')
    expect(secteurFamily('Assurance')).toBe('banque')
    expect(secteurFamily('Défense / Sécurité nationale')).toBe('defense')
    expect(secteurFamily('Énergie / Utilities')).toBe('energie')
    expect(secteurFamily('Administration publique')).toBe('administration')
    expect(secteurFamily('Industrie / Manufacturing')).toBe('industrie')
  })
  it('reconnaît la famille juridique (avocat / notaire)', () => {
    expect(secteurFamily("Professions juridiques / Cabinet d'avocats")).toBe('juridique')
    expect(secteurFamily('Notaire')).toBe('juridique')
  })
  it('renvoie null pour un secteur sans sous-secteurs ou vide', () => {
    expect(secteurFamily('Tourisme / Hôtellerie-restauration')).toBeNull()
    expect(secteurFamily('Autre')).toBeNull()
    expect(secteurFamily('')).toBeNull()
    expect(secteurFamily(null)).toBeNull()
  })
})

describe('sousSecteurIdsFor', () => {
  it('liste les ids de sous-secteurs du secteur', () => {
    const sante = sousSecteurIdsFor('Santé / Médico-social')
    expect(sante).toContain('sante-hopital')
    expect(sante).toContain('sante-editeur')
    expect(sante.length).toBeGreaterThanOrEqual(4)
  })
  it('renvoie [] pour un secteur sans taxonomie', () => {
    expect(sousSecteurIdsFor('Médias / Culture')).toEqual([])
  })
})

describe('isSousSecteurOfSecteur', () => {
  it('valide la cohérence secteur ↔ sous-secteur', () => {
    expect(isSousSecteurOfSecteur('Banque / Finance', 'banque-fintech')).toBe(true)
    expect(isSousSecteurOfSecteur('Banque / Finance', 'sante-hopital')).toBe(false)
    expect(isSousSecteurOfSecteur('Santé / Médico-social', undefined)).toBe(false)
  })
})
