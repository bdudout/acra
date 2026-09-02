import { describe, it, expect } from 'vitest'
import { CATALOGUES_CONTROLES, getCatalogueControle } from '@/lib/controles-catalogue'
import { CONTROLE_NIVEAUX, PERIODICITES, cleanControleInput, validateControleInput } from '@/lib/controle'
import { grcBuiltinByCode } from '@/lib/referentiels-builtins-grc'

describe('controles-catalogue', () => {
  it('expose les socles cyber et non-cyber (P1 + P2 banque/assurance)', () => {
    expect(CATALOGUES_CONTROLES.map(c => c.id).sort()).toEqual([
      'CREDIT_OCTROI', 'DORA', 'GAFI', 'IDD', 'ISO27001', 'LCB_FT', 'MAR', 'MIF2',
      'RGPD', 'SANCTIONS_GEL', 'SOLVA2',
    ])
  })

  it('les socles non-cyber pointent des exigences RÉELLES de leur cadre GRC livré', () => {
    for (const cat of CATALOGUES_CONTROLES) {
      const grc = grcBuiltinByCode(cat.referentielCode)
      if (!grc) continue // socle cyber (ISO/DORA) — hors de ce contrôle
      const refs = new Set(grc.exigences.map(e => e.ref))
      for (const t of cat.controles) {
        for (const r of t.exigenceRefs) {
          expect(refs.has(r), `exigence ${r} absente de ${cat.referentielCode}`).toBe(true)
        }
      }
    }
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
