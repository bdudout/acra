import { describe, it, expect } from 'vitest'
import { secteurFamily, sousSecteurIdsFor, isSousSecteurOfSecteur, showsHdsCaveat, normalizeSousSecteurs } from '@/lib/sous-secteurs'
import { getEbiosData } from '@/lib/ebios-data-i18n'

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

describe('showsHdsCaveat (issue #78) — pas de faux positif pour les hébergeurs', () => {
  it('masque la note pour un CHU et un EHPAD (hébergeurs HDS réels)', () => {
    expect(showsHdsCaveat('sante-hopital')).toBe(false)
    expect(showsHdsCaveat('sante-ehpad')).toBe(false)
  })
  it('affiche la note pour les profils non-hébergeurs', () => {
    expect(showsHdsCaveat('sante-clinique')).toBe(true)
    expect(showsHdsCaveat('sante-labo')).toBe(true)
    expect(showsHdsCaveat('sante-editeur')).toBe(true)
  })
  it('affiche la note quand le sous-secteur n\'est pas précisé (mise en garde générale)', () => {
    expect(showsHdsCaveat(undefined)).toBe(true)
    expect(showsHdsCaveat(null)).toBe(true)
    expect(showsHdsCaveat('')).toBe(true)
  })
})

describe('isSousSecteurOfSecteur', () => {
  it('valide la cohérence secteur ↔ sous-secteur', () => {
    expect(isSousSecteurOfSecteur('Banque / Finance', 'banque-fintech')).toBe(true)
    expect(isSousSecteurOfSecteur('Banque / Finance', 'sante-hopital')).toBe(false)
    expect(isSousSecteurOfSecteur('Santé / Médico-social', undefined)).toBe(false)
  })
})

// Pack postal, lot L2 : secteur « Services postaux et d'expédition » (directive (UE) 2022/2555, annexe II, secteur 1)
// et ses 6 sous-secteurs ; famille postale résolue avant le transport, sans faire basculer les secteurs existants.
describe('famille postale', () => {
  const POSTAL = ['postal-courrier', 'postal-colis', 'postal-reseau', 'postal-international', 'postal-elogistique', 'postal-domicile']
  it('le secteur postal est reconnu dans les 5 langues, avec ses 6 sous-secteurs', () => {
    for (const l of ['fr', 'en', 'de', 'es', 'it'] as const) {
      const lib = (getEbiosData(l).SECTEURS_ACTIVITE as readonly string[]).find(x => secteurFamily(x) === 'postal')
      expect(lib, l).toBeTruthy()
      expect(sousSecteurIdsFor(lib), l).toEqual(POSTAL)
    }
  })
  it('aucun secteur existant ne bascule dans la famille postale', () => {
    expect(secteurFamily('Transports / Logistique')).toBe('transport')
    expect(secteurFamily('Protection sociale / Sécurité sociale')).toBe('protection_sociale')
    expect(secteurFamily('Médias / Culture')).toBeNull()
    const fr = getEbiosData('fr').SECTEURS_ACTIVITE as readonly string[]
    expect(fr.filter(x => secteurFamily(x) === 'postal')).toHaveLength(1)
  })
  it('les sous-secteurs postaux sont refusés sous « Transports / Logistique »', () => {
    expect(normalizeSousSecteurs('Transports / Logistique', ['postal-colis', 'transport-logistique'])).toEqual(['transport-logistique'])
    expect(isSousSecteurOfSecteur('Transports / Logistique', 'postal-colis')).toBe(false)
  })
})

// Pack postal, lot L8 : sous-secteurs numérique, télécoms et banque à réseau tiers (taxonomie existante, aucun écran).
describe('familles numérique et télécoms ; banque à réseau tiers', () => {
  const NUM = ['numerique-confiance', 'numerique-identite', 'numerique-coffre', 'numerique-cloud', 'numerique-editeur', 'numerique-esn']
  const TEL = ['telecom-reseau', 'telecom-virtuel', 'telecom-fai']
  it('numérique et télécoms reconnus dans les 5 langues avec leurs sous-secteurs', () => {
    for (const l of ['fr', 'en', 'de', 'es', 'it'] as const) {
      const liste = getEbiosData(l).SECTEURS_ACTIVITE as readonly string[]
      expect(sousSecteurIdsFor(liste[6]), `${l} ${liste[6]}`).toEqual(NUM)
      expect(sousSecteurIdsFor(liste[8]), `${l} ${liste[8]}`).toEqual(TEL)
    }
  })
  it('banque : sous-secteur « réseau de guichets tenu par une autre entité » ; pas de collision', () => {
    expect(sousSecteurIdsFor('Banque / Finance')).toContain('banque-reseau-tiers')
    expect(secteurFamily('Transports / Logistique')).toBe('transport')
    expect(secteurFamily('Services postaux et d’expédition')).toBe('postal')
    expect(secteurFamily('Commerce / Distribution')).toBeNull()
    expect(normalizeSousSecteurs('Banque / Finance', ['telecom-virtuel', 'banque-reseau-tiers'])).toEqual(['banque-reseau-tiers'])
  })
})

