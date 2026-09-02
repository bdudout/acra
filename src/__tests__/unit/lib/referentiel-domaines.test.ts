import { describe, it, expect } from 'vitest'
import {
  DOMAINES,
  DOMAINE_META,
  DEFAULT_DOMAINE,
  isDomaine,
  coerceDomaine,
  domaineLabel,
} from '../../../lib/referentiel-domaines'

describe('DOMAINES (univers de contrôle & audit)', () => {
  it('contient les 11 domaines de la taxonomie GRC', () => {
    expect(DOMAINES).toEqual([
      'SECURITE_SI',
      'PROTECTION_DONNEES',
      'LCB_FT',
      'SANCTIONS_GEL',
      'PROTECTION_CLIENTELE',
      'DEONTOLOGIE',
      'COMPTABLE_FINANCIER',
      'CREDIT_CONTREPARTIE',
      'RISQUE_OPERATIONNEL',
      'GOUVERNANCE_CONTROLE',
      'AUTRE',
    ])
  })

  it('a une métadonnée (label + description) pour chaque domaine', () => {
    for (const d of DOMAINES) {
      expect(DOMAINE_META[d]).toBeDefined()
      expect(DOMAINE_META[d].label.length).toBeGreaterThan(0)
      expect(DOMAINE_META[d].description.length).toBeGreaterThan(0)
    }
  })

  it('utilise SECURITE_SI comme domaine par défaut (rétrocompatibilité cyber)', () => {
    expect(DEFAULT_DOMAINE).toBe('SECURITE_SI')
  })
})

describe('isDomaine', () => {
  it('reconnaît un code de domaine valide', () => {
    expect(isDomaine('LCB_FT')).toBe(true)
    expect(isDomaine('SECURITE_SI')).toBe(true)
  })
  it('rejette une valeur inconnue', () => {
    expect(isDomaine('CYBER')).toBe(false)
    expect(isDomaine('')).toBe(false)
    expect(isDomaine(null)).toBe(false)
    expect(isDomaine(42)).toBe(false)
  })
})

describe('coerceDomaine', () => {
  it('retourne le domaine s’il est valide', () => {
    expect(coerceDomaine('SANCTIONS_GEL')).toBe('SANCTIONS_GEL')
  })
  it('retombe sur le défaut pour une valeur invalide (rétrocompatible)', () => {
    expect(coerceDomaine(undefined)).toBe('SECURITE_SI')
    expect(coerceDomaine('n’importe quoi')).toBe('SECURITE_SI')
  })
})

describe('domaineLabel', () => {
  it('retourne le libellé lisible d’un domaine', () => {
    expect(domaineLabel('LCB_FT')).toBe(DOMAINE_META.LCB_FT.label)
  })
  it('retombe sur le label du défaut pour un code inconnu', () => {
    expect(domaineLabel('ZZZ')).toBe(DOMAINE_META.SECURITE_SI.label)
  })
})
