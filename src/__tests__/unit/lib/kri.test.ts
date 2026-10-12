import { describe, it, expect } from 'vitest'
import {
  evaluerKri, tendanceKri, synthetiserKri,
  validateKriInput, cleanKriInput, validateMesureInput, cleanMesureInput,
} from '@/lib/kri'

describe('kri — évaluation du statut', () => {
  const hausse = { sens: 'HAUSSE' as const, seuilAlerte: 5, seuilCritique: 10 }
  const baisse = { sens: 'BAISSE' as const, seuilAlerte: 80, seuilCritique: 50 }

  it('sens HAUSSE : plus haut = pire', () => {
    expect(evaluerKri(3, hausse)).toBe('NORMAL')
    expect(evaluerKri(5, hausse)).toBe('ALERTE')
    expect(evaluerKri(9, hausse)).toBe('ALERTE')
    expect(evaluerKri(10, hausse)).toBe('CRITIQUE')
    expect(evaluerKri(20, hausse)).toBe('CRITIQUE')
  })
  it('sens BAISSE : plus bas = pire', () => {
    expect(evaluerKri(90, baisse)).toBe('NORMAL')
    expect(evaluerKri(80, baisse)).toBe('ALERTE')
    expect(evaluerKri(55, baisse)).toBe('ALERTE')
    expect(evaluerKri(50, baisse)).toBe('CRITIQUE')
    expect(evaluerKri(10, baisse)).toBe('CRITIQUE')
  })
  it('valeur absente → INCONNU', () => {
    expect(evaluerKri(null, hausse)).toBe('INCONNU')
    expect(evaluerKri(undefined, hausse)).toBe('INCONNU')
  })
})

describe('kri — tendance', () => {
  it('interprète la variation selon le sens', () => {
    expect(tendanceKri(8, 5, 'HAUSSE')).toBe('DEGRADATION') // monte, HAUSSE = pire
    expect(tendanceKri(3, 5, 'HAUSSE')).toBe('AMELIORATION')
    expect(tendanceKri(8, 5, 'BAISSE')).toBe('AMELIORATION') // monte, BAISSE = mieux
    expect(tendanceKri(3, 5, 'BAISSE')).toBe('DEGRADATION')
    expect(tendanceKri(5, 5, 'HAUSSE')).toBe('STABLE')
    expect(tendanceKri(5, null, 'HAUSSE')).toBe('INCONNU')
  })
})

describe('kri — synthèse', () => {
  it('compte par statut, enAlerte = alerte + critique', () => {
    const s = synthetiserKri([
      { statut: 'NORMAL' }, { statut: 'ALERTE' }, { statut: 'CRITIQUE' }, { statut: 'CRITIQUE' }, { statut: 'INCONNU' },
    ])
    expect(s).toEqual({ total: 5, normal: 1, alerte: 1, critique: 2, inconnu: 1, enAlerte: 3 })
  })
})

describe('kri — validation définition', () => {
  const base = { intitule: 'Taux de fraude', sens: 'HAUSSE', seuilAlerte: 5, seuilCritique: 10 }
  it('accepte une définition valide', () => {
    expect(validateKriInput(base)).toBeNull()
  })
  it('exige intitulé, sens, seuils', () => {
    expect(validateKriInput({ ...base, intitule: ' ' })).toBe('intitule_requis')
    expect(validateKriInput({ ...base, sens: 'X' })).toBe('sens_invalide')
    expect(validateKriInput({ ...base, seuilAlerte: '' })).toBe('seuil_requis')
  })
  it('vérifie la cohérence des seuils selon le sens', () => {
    expect(validateKriInput({ ...base, seuilAlerte: 10, seuilCritique: 5 })).toBe('seuils_incoherents') // HAUSSE : critique < alerte
    expect(validateKriInput({ sens: 'BAISSE', intitule: 'x', seuilAlerte: 50, seuilCritique: 80 })).toBe('seuils_incoherents')
    expect(validateKriInput({ sens: 'BAISSE', intitule: 'x', seuilAlerte: 80, seuilCritique: 50 })).toBeNull()
  })
  it('partiel : ne valide que le présent', () => {
    expect(validateKriInput({ responsable: 'DSI' }, { partial: true })).toBeNull()
    expect(validateKriInput({ sens: 'X' }, { partial: true })).toBe('sens_invalide')
  })
  it('nettoie avec des défauts', () => {
    const c = cleanKriInput({ intitule: '  KRI  ', sens: 'BAISSE', seuilAlerte: '80', seuilCritique: '50', unite: '%', frequence: 'ZZ' })
    expect(c).toMatchObject({ intitule: 'KRI', sens: 'BAISSE', seuilAlerte: 80, seuilCritique: 50, unite: '%', frequence: 'MENSUEL', actif: true })
  })
})

describe('kri — validation mesure', () => {
  it('exige une valeur numérique', () => {
    expect(validateMesureInput({ valeur: 7 })).toBeNull()
    expect(validateMesureInput({ valeur: 'abc' })).toBe('valeur_requise')
    expect(validateMesureInput({})).toBe('valeur_requise')
    expect(validateMesureInput({ valeur: 7, dateMesure: 'pas-une-date' })).toBe('date_invalide')
  })
  it('nettoie la mesure', () => {
    const c = cleanMesureInput({ valeur: '12.5', commentaire: '  ok  ' })
    expect(c.valeur).toBe(12.5)
    expect(c.commentaire).toBe('ok')
    expect(c.dateMesure).toBeNull()
  })
})

describe('evaluerKri — seuils non définis (KRI issu du catalogue)', () => {
  it('sans seuil, le statut reste INCONNU même avec un relevé : jamais de voyant « vert » par défaut', () => {
    expect(evaluerKri(12, { sens: 'HAUSSE', seuilAlerte: null, seuilCritique: null })).toBe('INCONNU')
    expect(evaluerKri(12, { sens: 'BAISSE', seuilAlerte: 5, seuilCritique: null })).toBe('INCONNU')
    expect(evaluerKri(12, { sens: 'HAUSSE', seuilAlerte: null, seuilCritique: 20 })).toBe('INCONNU')
  })
})

// Recette n° 35 : KRI rattaché à une catégorie de taxonomie (bâloise) → mesure de la période pré-remplie avec le nombre
// d'incidents de cette catégorie (survenus, ou déclarés à défaut, depuis le début de la période) ; à confirmer par l'utilisateur.
import { debutPeriodeKri, suggestionIncidentsKri } from '@/lib/kri'
describe('suggestion de mesure depuis les incidents', () => {
  const now = new Date('2026-10-12T09:00:00Z')
  it('début de période selon la fréquence (UTC)', () => {
    expect(debutPeriodeKri('MENSUEL', now).toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(debutPeriodeKri('TRIMESTRIEL', now).toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(debutPeriodeKri('SEMESTRIEL', now).toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(debutPeriodeKri('ANNUEL', now).toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })
  it('compte les incidents de la catégorie dans la période ; sans catégorie → null', () => {
    const incidents = [
      { taxonomieCode: 'BALE_2', dateSurvenance: new Date('2026-10-11T00:00:00Z'), createdAt: new Date('2026-10-11T00:00:00Z') },
      { taxonomieCode: 'BALE_2', dateSurvenance: null, createdAt: new Date('2026-10-03T00:00:00Z') },
      { taxonomieCode: 'BALE_2', dateSurvenance: new Date('2026-09-28T00:00:00Z'), createdAt: new Date('2026-10-02T00:00:00Z') },
      { taxonomieCode: 'BALE_1', dateSurvenance: new Date('2026-10-05T00:00:00Z'), createdAt: new Date('2026-10-05T00:00:00Z') },
    ]
    expect(suggestionIncidentsKri({ taxonomieCode: 'BALE_2', frequence: 'MENSUEL' }, incidents, now)).toEqual({ nombre: 2, depuis: '2026-10-01' })
    expect(suggestionIncidentsKri({ taxonomieCode: 'BALE_2', frequence: 'TRIMESTRIEL' }, incidents, now)?.nombre).toBe(2)
    expect(suggestionIncidentsKri({ taxonomieCode: 'BALE_2', frequence: 'ANNUEL' }, incidents, now)?.nombre).toBe(3)
    expect(suggestionIncidentsKri({ taxonomieCode: null, frequence: 'MENSUEL' }, incidents, now)).toBeNull()
  })
})

