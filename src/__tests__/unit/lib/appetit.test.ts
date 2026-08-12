import { describe, it, expect } from 'vitest'
import {
  seuilApplicable, evaluerAppetit, estHorsAppetit, synthetiserAppetit,
  validateAppetitConfig, cleanAppetitConfig, APPETIT_DEFAULT,
  type AppetitConfig,
} from '@/lib/appetit'

const cfg: AppetitConfig = { seuilGlobal: 8, parCategorie: { EXEC: 4, FRAUDE: 12 } }

describe('appetit — seuil applicable', () => {
  it('surcharge par catégorie sinon global', () => {
    expect(seuilApplicable(cfg, 'EXEC')).toBe(4)
    expect(seuilApplicable(cfg, 'FRAUDE')).toBe(12)
    expect(seuilApplicable(cfg, 'AUTRE')).toBe(8) // pas de surcharge → global
    expect(seuilApplicable(cfg, null)).toBe(8)
    expect(seuilApplicable(APPETIT_DEFAULT, 'EXEC')).toBeNull() // aucun appétit
  })
})

describe('appetit — évaluation', () => {
  it('HORS si le résiduel dépasse strictement le seuil', () => {
    expect(evaluerAppetit(9, 8)).toBe('HORS')
    expect(evaluerAppetit(8, 8)).toBe('DANS') // au seuil = acceptable
    expect(evaluerAppetit(3, 8)).toBe('DANS')
  })
  it('INCONNU sans seuil ou sans cotation', () => {
    expect(evaluerAppetit(20, null)).toBe('INCONNU')
    expect(evaluerAppetit(null, 8)).toBe('INCONNU')
  })
  it('estHorsAppetit applique la surcharge de catégorie', () => {
    expect(estHorsAppetit({ taxonomieCode: 'EXEC', niveauResiduel: 6 }, cfg)).toBe(true) // 6 > 4
    expect(estHorsAppetit({ taxonomieCode: 'FRAUDE', niveauResiduel: 6 }, cfg)).toBe(false) // 6 <= 12
  })
})

describe('appetit — synthèse', () => {
  it('compte hors/dans/sans seuil', () => {
    const s = synthetiserAppetit([
      { taxonomieCode: 'EXEC', niveauResiduel: 6 }, // hors (6>4)
      { taxonomieCode: 'FRAUDE', niveauResiduel: 6 }, // dans (6<=12)
      { taxonomieCode: 'AUTRE', niveauResiduel: 20 }, // hors (20>8)
      { taxonomieCode: 'AUTRE', niveauResiduel: null }, // non coté → sans seuil
    ], cfg)
    expect(s).toEqual({ total: 4, evalues: 3, horsAppetit: 2, dansAppetit: 1, sansSeuil: 1 })
  })
  it('aucun appétit défini → tout sans seuil', () => {
    const s = synthetiserAppetit([{ taxonomieCode: 'X', niveauResiduel: 25 }], APPETIT_DEFAULT)
    expect(s.horsAppetit).toBe(0)
    expect(s.sansSeuil).toBe(1)
  })
})

describe('appetit — validation & nettoyage', () => {
  it('valide les seuils dans [1,25]', () => {
    expect(validateAppetitConfig({ seuilGlobal: 8, parCategorie: { A: 25 } })).toBeNull()
    expect(validateAppetitConfig({ seuilGlobal: null })).toBeNull()
    expect(validateAppetitConfig({ seuilGlobal: 0 })).toBe('seuil_invalide')
    expect(validateAppetitConfig({ seuilGlobal: 26 })).toBe('seuil_invalide')
    expect(validateAppetitConfig({ parCategorie: { A: 99 } })).toBe('seuil_invalide')
    expect(validateAppetitConfig(null)).toBe('config_invalide')
  })
  it('nettoie : borne les seuils, retire les catégories vides', () => {
    expect(cleanAppetitConfig({ seuilGlobal: '9', parCategorie: { A: 3, B: '', C: 40 } }))
      .toEqual({ seuilGlobal: 9, parCategorie: { A: 3, C: 25 } })
    expect(cleanAppetitConfig({})).toEqual({ seuilGlobal: null, parCategorie: {} })
  })
})
