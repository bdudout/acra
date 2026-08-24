import { describe, it, expect } from 'vitest'
import {
  validateControleInput, cleanControleInput, validateExecutionInput, cleanExecutionInput,
  prochaineEcheance, etatEcheance, evaluerEfficacite, libelleActionAnomalie,
  OCCURRENCES_PAR_AN, CONTROLE_NIVEAUX, PERIODICITES, RESULTATS,
  cleanChecklist, cleanChecklistResultats, deduireResultatChecklist, CHECKLIST_STATUTS,
  filtrerControles,
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
  it('superviseIds (contrôle du contrôle N2→N1) : nettoyés et dédupliqués', () => {
    expect(cleanControleInput({ intitule: 'X', superviseIds: ['a', 'a', ' b ', 3, ''] }).superviseIds).toEqual(['a', 'b'])
    expect(cleanControleInput({ intitule: 'X' }).superviseIds).toEqual([])
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
  it('indépendance de l\'exécutant : booléen ou null', () => {
    expect(cleanExecutionInput({ resultat: 'CONFORME', independant: true }).independant).toBe(true)
    expect(cleanExecutionInput({ resultat: 'CONFORME', independant: false }).independant).toBe(false)
    expect(cleanExecutionInput({ resultat: 'CONFORME' }).independant).toBeNull()
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

describe('cleanChecklist (points à vérifier d\'un contrôle)', () => {
  it('trim, non vides, dédupliqués (insensible espaces), plafonné à 50', () => {
    expect(cleanChecklist(['  A ', 'B', 'A', ''])).toEqual(['A', 'B'])
    expect(cleanChecklist('pas un tableau')).toEqual([])
    expect(cleanChecklist(null)).toEqual([])
    expect(cleanChecklist(Array.from({ length: 60 }, (_, i) => `p${i}`)).length).toBe(50)
  })
  it('accepte des objets {label} comme des chaînes', () => {
    expect(cleanChecklist([{ label: ' X ' }, 'Y'])).toEqual(['X', 'Y'])
  })
})

describe('cleanChecklistResultats', () => {
  it('garde label + statut valides, commentaire trimé ou null', () => {
    const r = cleanChecklistResultats([
      { label: ' Point 1 ', statut: 'OK' },
      { label: 'P2', statut: 'KO', commentaire: '  souci ' },
      { label: '', statut: 'OK' },          // label vide → ignoré
      { label: 'P3', statut: 'BOGUS' },     // statut invalide → ignoré
    ])
    expect(r).toEqual([
      { label: 'Point 1', statut: 'OK', commentaire: null },
      { label: 'P2', statut: 'KO', commentaire: 'souci' },
    ])
  })
  it('entrée non tableau → []', () => {
    expect(cleanChecklistResultats(null)).toEqual([])
  })
})

describe('deduireResultatChecklist', () => {
  it('checklist vide → null (résultat saisi manuellement)', () => {
    expect(deduireResultatChecklist([])).toBeNull()
  })
  it('au moins un KO → ANOMALIE, compte les KO, taille = OK+KO', () => {
    expect(deduireResultatChecklist([
      { label: 'a', statut: 'OK' }, { label: 'b', statut: 'KO' }, { label: 'c', statut: 'KO' },
    ])).toEqual({ resultat: 'ANOMALIE', anomaliesTrouvees: 2, tailleTestee: 3 })
  })
  it('tous NA → NON_APPLICABLE', () => {
    expect(deduireResultatChecklist([
      { label: 'a', statut: 'NA' }, { label: 'b', statut: 'NA' },
    ])).toEqual({ resultat: 'NON_APPLICABLE', anomaliesTrouvees: 0, tailleTestee: 0 })
  })
  it('OK (avec NA) sans KO → CONFORME, taille = OK+KO', () => {
    expect(deduireResultatChecklist([
      { label: 'a', statut: 'OK' }, { label: 'b', statut: 'NA' },
    ])).toEqual({ resultat: 'CONFORME', anomaliesTrouvees: 0, tailleTestee: 1 })
  })
})

describe('filtrerControles', () => {
  const base = (o: Partial<Parameters<typeof filtrerControles>[0][number]>) => ({
    intitule: 'Contrôle', responsable: null, niveau: 'N1', etatEcheance: 'A_VENIR' as const,
    referentielCode: null, actif: true, ...o,
  })
  const list = [
    base({ intitule: 'Revue des accès à privilèges', responsable: 'Alice', niveau: 'N2', etatEcheance: 'EN_RETARD', referentielCode: 'ISO27001', actif: true }),
    base({ intitule: 'Test de restauration', responsable: 'Bob', niveau: 'N1', etatEcheance: 'DU', referentielCode: 'DORA', actif: true }),
    base({ intitule: 'Ancien contrôle', responsable: null, niveau: 'N1', etatEcheance: null, referentielCode: null, actif: false }),
  ]
  it('sans filtre → liste inchangée', () => {
    expect(filtrerControles(list, {})).toHaveLength(3)
  })
  it('recherche insensible casse/accents sur intitulé et responsable', () => {
    expect(filtrerControles(list, { q: 'acces' }).map(c => c.responsable)).toEqual(['Alice'])
    expect(filtrerControles(list, { q: 'BOB' }).map(c => c.intitule)).toEqual(['Test de restauration'])
  })
  it('filtre par niveau, état, référentiel', () => {
    expect(filtrerControles(list, { niveau: 'N2' })).toHaveLength(1)
    expect(filtrerControles(list, { etat: 'DU' }).map(c => c.responsable)).toEqual(['Bob'])
    expect(filtrerControles(list, { referentielCode: 'DORA' })).toHaveLength(1)
  })
  it('filtre par actif (true/false)', () => {
    expect(filtrerControles(list, { actif: 'false' })).toHaveLength(1)
    expect(filtrerControles(list, { actif: 'true' })).toHaveLength(2)
  })
  it('combine les filtres (ET logique)', () => {
    expect(filtrerControles(list, { niveau: 'N1', actif: 'true' })).toHaveLength(1)
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
    expect([...CHECKLIST_STATUTS]).toEqual(['OK', 'KO', 'NA'])
  })
  it('libellé du plan d\'action généré sur anomalie', () => {
    expect(libelleActionAnomalie('Rapprochement bancaire')).toBe("Traiter l'anomalie : Rapprochement bancaire")
  })
})
