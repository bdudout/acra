import { describe, it, expect } from 'vitest'
import { CATALOGUES_CONTROLES, getCatalogueControle } from '@/lib/controles-catalogue'
import { CONTROLE_NIVEAUX, PERIODICITES, cleanControleInput, validateControleInput } from '@/lib/controle'

describe('controles-catalogue', () => {
  it('expose les socles ISO27001 et DORA', () => {
    expect(CATALOGUES_CONTROLES.map(c => c.id).sort()).toEqual(['DORA', 'ISO27001'])
  })

  it('getCatalogueControle retrouve un socle et renvoie undefined sinon', () => {
    expect(getCatalogueControle('ISO27001')?.controles.length).toBeGreaterThan(5)
    expect(getCatalogueControle('BOGUS')).toBeUndefined()
  })

  it('chaque modèle a un niveau, une périodicité et une checklist valides', () => {
    for (const cat of CATALOGUES_CONTROLES) {
      for (const t of cat.controles) {
        expect(t.intitule.trim()).not.toBe('')
        expect(CONTROLE_NIVEAUX).toContain(t.niveau)
        expect(PERIODICITES).toContain(t.periodicite)
        expect(t.referentielCode).toBe(cat.referentielCode)
        expect(t.exigenceRefs.length).toBeGreaterThan(0)
        expect(t.checklist.length).toBeGreaterThan(0)
      }
    }
  })

  it('les modèles passent la validation/normalisation des contrôles', () => {
    for (const cat of CATALOGUES_CONTROLES) {
      for (const t of cat.controles) {
        expect(validateControleInput(t)).toBeNull()
        const c = cleanControleInput(t)
        expect(c.niveau).toBe(t.niveau)
        expect(c.checklist).toEqual(t.checklist)
        expect(c.exigenceRefs).toEqual(t.exigenceRefs)
      }
    }
  })

  it('intitulés uniques au sein d\'un socle', () => {
    for (const cat of CATALOGUES_CONTROLES) {
      const noms = cat.controles.map(t => t.intitule)
      expect(new Set(noms).size).toBe(noms.length)
    }
  })
})
