// Saisie directe de risque (pur) — appréciation G×V pour méthodes type ISO 31000.
import { describe, it, expect } from 'vitest'
import {
  sanitizeDirectRisque, isDirectRisqueValid, sanitizeDirectRisquePatch, directNiveau,
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

describe('usesDirectRiskEntry', () => {
  it('ISO 31000 = saisie directe ; EBIOS RM = non (risques dérivés des scénarios)', () => {
    expect(usesDirectRiskEntry('ISO_31000')).toBe(true)
    expect(usesDirectRiskEntry('EBIOS_RM')).toBe(false)
    expect(usesDirectRiskEntry('ZZZ')).toBe(false)
  })
})
