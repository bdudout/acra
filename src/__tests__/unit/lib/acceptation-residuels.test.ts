import { describe, it, expect } from 'vitest'
import { resumeRisquesResiduels, motifBlocageAcceptation } from '@/lib/acceptation-residuels'

// Recette n° 56 : la Direction métier acceptait « à l'aveugle » les risques résiduels d'une
// analyse encore EN_COURS, sans voir ni les niveaux ni les risques non cotés.
describe('resumeRisquesResiduels', () => {
  it('ventile les risques par palier de niveau résiduel et compte les non cotés', () => {
    const r = resumeRisquesResiduels([
      { niveauResiduel: 16 }, { niveauResiduel: 9 }, { niveauResiduel: 4 }, { niveauResiduel: 2 }, { niveauResiduel: 1 },
      { niveauResiduel: null },
    ])
    expect(r).toEqual({ total: 6, parNiveau: { critique: 1, eleve: 1, modere: 1, faible: 2 }, nonCotes: 1 })
  })
  it('aucun risque → tout à zéro', () => {
    expect(resumeRisquesResiduels([])).toEqual({ total: 0, parNiveau: { critique: 0, eleve: 0, modere: 0, faible: 0 }, nonCotes: 0 })
  })
})

describe('motifBlocageAcceptation', () => {
  const cotes = resumeRisquesResiduels([{ niveauResiduel: 4 }])
  it('autorise une analyse SOUMIS ou APPROUVE dont tous les risques sont cotés', () => {
    expect(motifBlocageAcceptation('SOUMIS', cotes)).toBeNull()
    expect(motifBlocageAcceptation('APPROUVE', cotes)).toBeNull()
  })
  it('refuse une analyse ni soumise ni approuvée', () => {
    for (const s of ['EN_COURS', 'REJETE', 'TERMINE', 'ARCHIVE']) {
      expect(motifBlocageAcceptation(s, cotes)).toBe('ANALYSE_NON_SOUMISE')
    }
  })
  it('refuse tant qu\'un risque reste non coté', () => {
    expect(motifBlocageAcceptation('APPROUVE', resumeRisquesResiduels([{ niveauResiduel: 4 }, { niveauResiduel: null }]))).toBe('RISQUES_NON_COTES')
  })
  it('le statut prime sur la cotation', () => {
    expect(motifBlocageAcceptation('EN_COURS', resumeRisquesResiduels([{ niveauResiduel: null }]))).toBe('ANALYSE_NON_SOUMISE')
  })
})
