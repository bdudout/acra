import { describe, it, expect } from 'vitest'
import {
  validateControleInput, cleanControleInput, validateExecutionInput, cleanExecutionInput,
  prochaineEcheance, etatEcheance, evaluerEfficacite, libelleActionAnomalie,
  OCCURRENCES_PAR_AN, CONTROLE_NIVEAUX, PERIODICITES, RESULTATS,
} from '@/lib/controle'

describe('validateControleInput', () => {
  it('intitulé requis', () => {
    expect(validateControleInput({ intitule: '  ' })).toBe('intitule_requis')
    expect(validateControleInput({ intitule: 'Rapprochement bancaire' })).toBeNull()
  })
  it('niveau et périodicité contrôlés', () => {
    expect(validateControleInput({ intitule: 'X', niveau: 'N3' })).toBe('niveau_invalide')
    expect(validateControleInput({ intitule: 'X', periodicite: 'HEBDO' })).toBe('periodicite_invalide')
    expect(validateControleInput({ intitule: 'X', niveau: 'N2', periodicite: 'ANNUEL' })).toBeNull()
  })
  it('échantillon entier ≥ 1', () => {
    expect(validateControleInput({ intitule: 'X', tailleEchantillon: 0 })).toBe('echantillon_invalide')
    expect(validateControleInput({ intitule: 'X', tailleEchantillon: 2.5 })).toBe('echantillon_invalide')
    expect(validateControleInput({ intitule: 'X', tailleEchantillon: 30 })).toBeNull()
  })
})

describe('cleanControleInput', () => {
  it('défauts : N1, trimestriel, actif', () => {
    const c = cleanControleInput({ intitule: '  Contrôle caisse  ' })
    expect(c.intitule).toBe('Contrôle caisse')
    expect(c.niveau).toBe('N1')
    expect(c.periodicite).toBe('TRIMESTRIEL')
    expect(c.actif).toBe(true)
    expect(c.tailleEchantillon).toBeNull()
  })
  it('valeurs inconnues ramenées aux défauts', () => {
    const c = cleanControleInput({ intitule: 'X', niveau: 'BOGUS', periodicite: 'BOGUS' })
    expect(c.niveau).toBe('N1')
    expect(c.periodicite).toBe('TRIMESTRIEL')
  })
  it('actif explicitement désactivable', () => {
    expect(cleanControleInput({ intitule: 'X', actif: false }).actif).toBe(false)
  })
})

describe('validateExecutionInput', () => {
  it('résultat obligatoire et connu', () => {
    expect(validateExecutionInput({})).toBe('resultat_invalide')
    expect(validateExecutionInput({ resultat: 'PEUT_ETRE' })).toBe('resultat_invalide')
    expect(validateExecutionInput({ resultat: 'CONFORME' })).toBeNull()
  })
  it('une anomalie exige un constat écrit', () => {
    expect(validateExecutionInput({ resultat: 'ANOMALIE' })).toBe('constat_requis')
    expect(validateExecutionInput({ resultat: 'ANOMALIE', constat: '  ' })).toBe('constat_requis')
    expect(validateExecutionInput({ resultat: 'ANOMALIE', constat: '3 écarts non justifiés' })).toBeNull()
  })
  it('nombres entiers positifs, anomalies ≤ testées', () => {
    expect(validateExecutionInput({ resultat: 'CONFORME', tailleTestee: -1 })).toBe('nombre_invalide')
    expect(validateExecutionInput({ resultat: 'CONFORME', anomaliesTrouvees: 1.5 })).toBe('nombre_invalide')
    expect(validateExecutionInput({ resultat: 'CONFORME', tailleTestee: 10, anomaliesTrouvees: 12 })).toBe('anomalies_superieures')
    expect(validateExecutionInput({ resultat: 'CONFORME', tailleTestee: 10, anomaliesTrouvees: 2 })).toBeNull()
  })
  it('date invalide refusée', () => {
    expect(validateExecutionInput({ resultat: 'CONFORME', dateRealisation: 'nope' })).toBe('date_invalide')
  })
})

describe('cleanExecutionInput', () => {
  it('date par défaut = maintenant', () => {
    const now = new Date('2026-07-30T10:00:00Z')
    expect(cleanExecutionInput({ resultat: 'CONFORME' }, now).dateRealisation).toEqual(now)
  })
  it('normalise constat et compteurs', () => {
    const c = cleanExecutionInput({ resultat: 'ANOMALIE', constat: '  écart  ', tailleTestee: '30', anomaliesTrouvees: '2' })
    expect(c.constat).toBe('écart')
    expect(c.tailleTestee).toBe(30)
    expect(c.anomaliesTrouvees).toBe(2)
  })
})

describe('prochaineEcheance', () => {
  it('dernière exécution + une période', () => {
    expect(prochaineEcheance('MENSUEL', '2026-01-15', '2025-01-01').toISOString().slice(0, 10)).toBe('2026-02-15')
    expect(prochaineEcheance('TRIMESTRIEL', '2026-01-15', '2025-01-01').toISOString().slice(0, 10)).toBe('2026-04-15')
    expect(prochaineEcheance('SEMESTRIEL', '2026-01-15', '2025-01-01').toISOString().slice(0, 10)).toBe('2026-07-15')
    expect(prochaineEcheance('ANNUEL', '2026-01-15', '2025-01-01').toISOString().slice(0, 10)).toBe('2027-01-15')
  })
  it('sans exécution : création + une période', () => {
    expect(prochaineEcheance('TRIMESTRIEL', null, '2026-01-15').toISOString().slice(0, 10)).toBe('2026-04-15')
  })
  it('borne le jour au dernier jour du mois cible (31 janvier + 1 mois)', () => {
    expect(prochaineEcheance('MENSUEL', '2026-01-31', '2025-01-01').toISOString().slice(0, 10)).toBe('2026-02-28')
  })
  it('hebdomadaire : dernière exécution + 7 jours (calcul en jours)', () => {
    expect(prochaineEcheance('HEBDOMADAIRE', '2026-01-15', '2025-01-01').toISOString().slice(0, 10)).toBe('2026-01-22')
    // franchit la fin de mois sans borner au dernier jour du mois
    expect(prochaineEcheance('HEBDOMADAIRE', '2026-01-28', '2025-01-01').toISOString().slice(0, 10)).toBe('2026-02-04')
  })
})

describe('etatEcheance', () => {
  const now = new Date('2026-07-30T12:00:00Z')
  it('dépassée → EN_RETARD', () => {
    expect(etatEcheance('2026-07-29', now)).toBe('EN_RETARD')
  })
  it('dans la fenêtre → DU', () => {
    expect(etatEcheance('2026-08-02', now)).toBe('DU')
    expect(etatEcheance('2026-08-06', now)).toBe('DU')
  })
  it('au-delà → A_VENIR', () => {
    expect(etatEcheance('2026-09-15', now)).toBe('A_VENIR')
  })
})

describe('evaluerEfficacite', () => {
  const ex = (resultat: string) => ({ resultat, dateRealisation: '2026-07-01' })
  it('aucune exécution évaluable → tout null', () => {
    expect(evaluerEfficacite([])).toEqual({ evaluees: 0, conformes: 0, anomalies: 0, tauxConformite: null, efficacite: null, vraisemblanceSuggeree: null })
    // NON_APPLICABLE seul : non évaluable
    expect(evaluerEfficacite([ex('NON_APPLICABLE')]).tauxConformite).toBeNull()
  })
  it('NON_APPLICABLE exclu du calcul', () => {
    const e = evaluerEfficacite([ex('CONFORME'), ex('NON_APPLICABLE')])
    expect(e.evaluees).toBe(1)
    expect(e.tauxConformite).toBe(100)
  })
  it('barème FORTE / MOYENNE / FAIBLE et vraisemblance suggérée', () => {
    const n = (c: number, a: number) => [...Array(c)].map(() => ex('CONFORME')).concat([...Array(a)].map(() => ex('ANOMALIE')))
    const forte = evaluerEfficacite(n(20, 0))
    expect(forte.tauxConformite).toBe(100); expect(forte.efficacite).toBe('FORTE'); expect(forte.vraisemblanceSuggeree).toBe(1)
    const moyenne = evaluerEfficacite(n(9, 1))   // 90 %
    expect(moyenne.efficacite).toBe('MOYENNE'); expect(moyenne.vraisemblanceSuggeree).toBe(3)
    const faible = evaluerEfficacite(n(1, 1))    // 50 %
    expect(faible.efficacite).toBe('FAIBLE'); expect(faible.vraisemblanceSuggeree).toBe(5)
  })
  it('compte anomalies et conformes', () => {
    const e = evaluerEfficacite([ex('CONFORME'), ex('ANOMALIE'), ex('ANOMALIE')])
    expect(e.conformes).toBe(1); expect(e.anomalies).toBe(2); expect(e.tauxConformite).toBe(33)
  })
})

describe('constantes et libellés', () => {
  it('occurrences par an', () => {
    expect(OCCURRENCES_PAR_AN).toEqual({ HEBDOMADAIRE: 52, MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 })
  })
  it('énumérations', () => {
    expect([...CONTROLE_NIVEAUX]).toEqual(['N1', 'N2'])
    expect([...PERIODICITES]).toEqual(['HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL'])
    expect([...RESULTATS]).toEqual(['CONFORME', 'ANOMALIE', 'NON_APPLICABLE'])
  })
  it('libellé du plan d\'action généré sur anomalie', () => {
    expect(libelleActionAnomalie('Rapprochement bancaire')).toBe("Traiter l'anomalie : Rapprochement bancaire")
  })
})
