// Saisie directe de risque (pur) — appréciation G×V pour méthodes type ISO 31000.
import { describe, it, expect } from 'vitest'
import {
  sanitizeDirectRisque, isDirectRisqueValid, sanitizeDirectRisquePatch, directNiveau, recomputeDirectNiveaux,
} from '@/lib/risque-direct'
import { usesDirectRiskEntry } from '@/lib/methodes'

describe('sanitizeDirectRisque', () => {
  it('borne G/V à [1,4] et RECALCULE le niveau (jamais la valeur fournie)', () => {
    const p = sanitizeDirectRisque({ nom: 'Panne SI', gravite: 9, vraisemblance: 3, niveauRisque: 1 })
    expect(p.gravite).toBe(4)      // clampé
    expect(p.vraisemblance).toBe(3)
    expect(p.niveauRisque).toBe(12) // 4×3, pas 1
  })

  it('normalise la stratégie inconnue vers REDUIRE ; tronque le nom', () => {
    expect(sanitizeDirectRisque({ nom: 'x', strategie: 'ZZZ' }).strategie).toBe('REDUIRE')
    expect(sanitizeDirectRisque({ nom: 'x', strategie: 'ACCEPTER' }).strategie).toBe('ACCEPTER')
    expect(sanitizeDirectRisque({ nom: 'a'.repeat(300) }).nom.length).toBe(255)
  })

  it('un intitulé est requis', () => {
    expect(isDirectRisqueValid(sanitizeDirectRisque({ nom: '  ' }))).toBe(false)
    expect(isDirectRisqueValid(sanitizeDirectRisque({ nom: 'OK' }))).toBe(true)
  })
})

describe('sanitizeDirectRisquePatch + directNiveau', () => {
  it('ne renvoie que les champs fournis, sans niveauRisque', () => {
    const patch = sanitizeDirectRisquePatch({ gravite: 3, evil: 'x' })
    expect(patch).toEqual({ gravite: 3 })
    expect(patch).not.toHaveProperty('niveauRisque')
    expect(patch).not.toHaveProperty('evil')
  })

  it('directNiveau = gravité × vraisemblance (recalcul par l\'appelant)', () => {
    expect(directNiveau(4, 3)).toBe(12)
    expect(directNiveau(1, 1)).toBe(1)
  })
})

describe('sanitizeDirectRisque — 3 niveaux (brut / actuel / résiduel)', () => {
  it('défauts chaînés : actuel ← brut, résiduel ← actuel', () => {
    const p = sanitizeDirectRisque({ nom: 'x', gravite: 4, vraisemblance: 3 })
    expect(p.niveauRisque).toBe(12)
    expect(p.graviteActuelle).toBe(4); expect(p.vraisemblanceActuelle).toBe(3); expect(p.niveauActuel).toBe(12)
    expect(p.graviteResiduelle).toBe(4); expect(p.vraisemblanceResiduelle).toBe(3); expect(p.niveauResiduel).toBe(12)
  })

  it('actuel/résiduel fournis : bornés et recalculés indépendamment', () => {
    const p = sanitizeDirectRisque({ nom: 'x', gravite: 4, vraisemblance: 3, graviteActuelle: 2, vraisemblanceActuelle: 3, graviteResiduelle: 1, vraisemblanceResiduelle: 2 })
    expect(p.niveauRisque).toBe(12)   // brut
    expect(p.niveauActuel).toBe(6)    // 2×3, avec mesures existantes
    expect(p.niveauResiduel).toBe(2)  // 1×2, après plans d'action
  })
})

describe('recomputeDirectNiveaux', () => {
  it('recalcule uniquement le niveau du niveau touché (valeurs fusionnées)', () => {
    const existing = { gravite: 4, vraisemblance: 3, graviteActuelle: 4, vraisemblanceActuelle: 3, graviteResiduelle: 4, vraisemblanceResiduelle: 3 }
    expect(recomputeDirectNiveaux({ graviteActuelle: 2 }, existing)).toEqual({ niveauActuel: 6 })
    expect(recomputeDirectNiveaux({ vraisemblanceResiduelle: 1 }, existing)).toEqual({ niveauResiduel: 4 })
    expect(recomputeDirectNiveaux({ gravite: 1 }, existing)).toEqual({ niveauRisque: 3 })
    expect(recomputeDirectNiveaux({ strategie: 'ACCEPTER' } as never, existing)).toEqual({})
  })
})

describe('usesDirectRiskEntry', () => {
  it('ISO 31000 = saisie directe ; EBIOS RM = non (risques dérivés des scénarios)', () => {
    expect(usesDirectRiskEntry('ISO_31000')).toBe(true)
    expect(usesDirectRiskEntry('EBIOS_RM')).toBe(false)
    expect(usesDirectRiskEntry('ZZZ')).toBe(false)
  })
})
