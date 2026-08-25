import { describe, it, expect } from 'vitest'
import {
  validateCampagneInput, cleanCampagneInput, transitionCampagneAutorisee,
  validateEvaluationInput, cleanEvaluationInput, evaluationComplete, suggestResiduel,
  transitionEvaluationAutorisee, peutValider, avancementCampagne, statutApresCotation,
  CAMPAGNE_STATUTS, EVALUATION_STATUTS, EFFICACITES,
} from '@/lib/campagne'

describe('validateCampagneInput', () => {
  it('intitulé requis', () => {
    expect(validateCampagneInput({ intitule: '  ' })).toBe('intitule_requis')
    expect(validateCampagneInput({ intitule: 'RCSA 2026 S1' })).toBeNull()
  })
  it('dates invalides refusées', () => {
    expect(validateCampagneInput({ intitule: 'X', dateDebut: 'nope' })).toBe('date_invalide')
    expect(validateCampagneInput({ intitule: 'X', dateFin: 'nope' })).toBe('date_invalide')
  })
  it('fin avant début refusée', () => {
    expect(validateCampagneInput({ intitule: 'X', dateDebut: '2026-06-01', dateFin: '2026-05-01' })).toBe('fin_avant_debut')
    expect(validateCampagneInput({ intitule: 'X', dateDebut: '2026-06-01', dateFin: '2026-06-30' })).toBeNull()
    // même jour accepté
    expect(validateCampagneInput({ intitule: 'X', dateDebut: '2026-06-01', dateFin: '2026-06-01' })).toBeNull()
  })
})

describe('cleanCampagneInput', () => {
  it('normalise', () => {
    const c = cleanCampagneInput({ intitule: '  RCSA  ', description: '  ', dateDebut: '2026-06-01' })
    expect(c.intitule).toBe('RCSA')
    expect(c.description).toBeNull()
    expect(c.dateDebut instanceof Date).toBe(true)
    expect(c.dateFin).toBeNull()
  })
})

describe('transitionCampagneAutorisee', () => {
  it('BROUILLON → OUVERTE → CLOTUREE, sans retour', () => {
    expect(transitionCampagneAutorisee('BROUILLON', 'OUVERTE')).toBe(true)
    expect(transitionCampagneAutorisee('OUVERTE', 'CLOTUREE')).toBe(true)
    expect(transitionCampagneAutorisee('BROUILLON', 'CLOTUREE')).toBe(false) // pas de raccourci
    expect(transitionCampagneAutorisee('OUVERTE', 'BROUILLON')).toBe(false)
    expect(transitionCampagneAutorisee('CLOTUREE', 'OUVERTE')).toBe(false)   // terminal
    expect(transitionCampagneAutorisee('OUVERTE', 'OUVERTE')).toBe(true)     // édition sur place
  })
})

describe('validateEvaluationInput', () => {
  it('cotes bornées 1-5', () => {
    expect(validateEvaluationInput({ graviteInherente: 0 })).toBe('cotation_invalide')
    expect(validateEvaluationInput({ vraisemblanceResiduelle: 6 })).toBe('cotation_invalide')
    expect(validateEvaluationInput({ graviteInherente: 3, vraisemblanceResiduelle: 2 })).toBeNull()
    expect(validateEvaluationInput({})).toBeNull() // cotation partielle autorisée
  })
  it('efficacité contrôlée', () => {
    expect(validateEvaluationInput({ efficaciteControles: 'BOF' })).toBe('efficacite_invalide')
    expect(validateEvaluationInput({ efficaciteControles: 'FORTE' })).toBeNull()
  })
})

describe('cleanEvaluationInput / evaluationComplete', () => {
  it('borne les cotes et ignore une efficacité inconnue', () => {
    const e = cleanEvaluationInput({ graviteInherente: 99, vraisemblanceInherente: '4', efficaciteControles: 'BOF', commentaire: ' ok ' })
    expect(e.graviteInherente).toBe(5)
    expect(e.vraisemblanceInherente).toBe(4)
    expect(e.efficaciteControles).toBeNull()
    expect(e.commentaire).toBe('ok')
  })
  it('complète seulement si inhérent ET résiduel renseignés', () => {
    expect(evaluationComplete(cleanEvaluationInput({ graviteInherente: 4, vraisemblanceInherente: 4 }))).toBe(false)
    expect(evaluationComplete(cleanEvaluationInput({
      graviteInherente: 4, vraisemblanceInherente: 4, graviteResiduelle: 3, vraisemblanceResiduelle: 2,
    }))).toBe(true)
  })
})

describe('suggestResiduel', () => {
  it('la réduction dépend de l\'efficacité déclarée', () => {
    expect(suggestResiduel(5, 'FORTE')).toBe(2)
    expect(suggestResiduel(5, 'MOYENNE')).toBe(3)
    expect(suggestResiduel(5, 'FAIBLE')).toBe(4)
    expect(suggestResiduel(5, 'INEXISTANTE')).toBe(5)
  })
  it('ne descend jamais sous 1', () => {
    expect(suggestResiduel(2, 'FORTE')).toBe(1)
    expect(suggestResiduel(1, 'FORTE')).toBe(1)
  })
  it('null si une donnée manque', () => {
    expect(suggestResiduel(null, 'FORTE')).toBeNull()
    expect(suggestResiduel(4, null)).toBeNull()
  })
})

describe('statutApresCotation (mode 2ᵉ ligne optionnelle)', () => {
  it('2ᵉ ligne active (défaut) → COTEE (validation distincte requise)', () => {
    expect(statutApresCotation(true)).toBe('COTEE')
    expect(statutApresCotation(undefined)).toBe('COTEE')
  })
  it('2ᵉ ligne désactivée (mode ligne unique) → VALIDEE (cotation vaut clôture)', () => {
    expect(statutApresCotation(false)).toBe('VALIDEE')
  })
})

describe('transitionEvaluationAutorisee', () => {
  it('A_COTER → COTEE → VALIDEE|REJETEE, REJETEE repasse en COTEE', () => {
    expect(transitionEvaluationAutorisee('A_COTER', 'COTEE')).toBe(true)
    expect(transitionEvaluationAutorisee('COTEE', 'VALIDEE')).toBe(true)
    expect(transitionEvaluationAutorisee('COTEE', 'REJETEE')).toBe(true)
    expect(transitionEvaluationAutorisee('REJETEE', 'COTEE')).toBe(true)
    expect(transitionEvaluationAutorisee('A_COTER', 'VALIDEE')).toBe(false) // pas de raccourci
    expect(transitionEvaluationAutorisee('VALIDEE', 'COTEE')).toBe(false)   // terminal
  })
})

describe('peutValider (quatre-yeux)', () => {
  it('le valideur ne peut pas être l\'évaluateur', () => {
    expect(peutValider('u1', 'u1')).toBe(false)
    expect(peutValider('u1', 'u2')).toBe(true)
    expect(peutValider(null, 'u2')).toBe(true)
  })
})

describe('avancementCampagne', () => {
  const e = (statut: string) => ({ statut })
  it('compte par statut et calcule le taux de validation', () => {
    const a = avancementCampagne([e('A_COTER'), e('COTEE'), e('VALIDEE'), e('VALIDEE'), e('REJETEE')])
    expect(a).toEqual({ total: 5, aCoter: 1, cotees: 1, validees: 2, rejetees: 1, tauxValidation: 40, complete: false })
  })
  it('complète quand tout est validé', () => {
    expect(avancementCampagne([e('VALIDEE'), e('VALIDEE')]).complete).toBe(true)
  })
  it('campagne vide : rien à clôturer', () => {
    const a = avancementCampagne([])
    expect(a.total).toBe(0)
    expect(a.tauxValidation).toBe(0)
    expect(a.complete).toBe(false)
  })
})

describe('énumérations', () => {
  it('statuts et efficacités', () => {
    expect([...CAMPAGNE_STATUTS]).toEqual(['BROUILLON', 'OUVERTE', 'CLOTUREE'])
    expect([...EVALUATION_STATUTS]).toEqual(['A_COTER', 'COTEE', 'VALIDEE', 'REJETEE'])
    expect([...EFFICACITES]).toEqual(['FORTE', 'MOYENNE', 'FAIBLE', 'INEXISTANTE'])
  })
})
