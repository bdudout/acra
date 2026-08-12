import { describe, it, expect } from 'vitest'
import {
  validateMissionInput, cleanMissionInput, transitionMissionAutorisee,
  validateConstatInput, cleanConstatInput, constatTermine, constatEnRetard, synthetiserConstats,
  MISSION_STATUTS, CONSTAT_STATUTS, CONSTAT_SOURCES,
} from '@/lib/audit'

describe('validateMissionInput', () => {
  it('intitulé requis', () => {
    expect(validateMissionInput({ intitule: '  ' })).toBe('intitule_requis')
    expect(validateMissionInput({ intitule: 'Audit du processus paie' })).toBeNull()
  })
  it('dates : invalide et fin avant début', () => {
    expect(validateMissionInput({ intitule: 'X', dateDebut: 'nope' })).toBe('date_invalide')
    expect(validateMissionInput({ intitule: 'X', dateDebut: '2026-06-01', dateFin: '2026-05-01' })).toBe('fin_avant_debut')
    expect(validateMissionInput({ intitule: 'X', dateDebut: '2026-06-01', dateFin: '2026-06-30' })).toBeNull()
  })
})

describe('cleanMissionInput', () => {
  it('normalise', () => {
    const m = cleanMissionInput({ intitule: '  Audit  ', objectif: ' ', perimetre: 'Paie, RH', responsable: 'Cabinet X' })
    expect(m.intitule).toBe('Audit')
    expect(m.objectif).toBeNull()
    expect(m.perimetre).toBe('Paie, RH')
    expect(m.responsable).toBe('Cabinet X')
  })
})

describe('transitionMissionAutorisee', () => {
  it('PLANIFIEE → EN_COURS → CLOTUREE, sans retour', () => {
    expect(transitionMissionAutorisee('PLANIFIEE', 'EN_COURS')).toBe(true)
    expect(transitionMissionAutorisee('EN_COURS', 'CLOTUREE')).toBe(true)
    expect(transitionMissionAutorisee('PLANIFIEE', 'CLOTUREE')).toBe(false)
    expect(transitionMissionAutorisee('CLOTUREE', 'EN_COURS')).toBe(false)
    expect(transitionMissionAutorisee('EN_COURS', 'EN_COURS')).toBe(true)
  })
})

describe('validateConstatInput', () => {
  it('criticité 1-4, source et statut connus', () => {
    expect(validateConstatInput({ intitule: 'X', criticite: 5 })).toBe('criticite_invalide')
    expect(validateConstatInput({ intitule: 'X', criticite: 0 })).toBe('criticite_invalide')
    expect(validateConstatInput({ intitule: 'X', source: 'BOF' })).toBe('source_invalide')
    expect(validateConstatInput({ intitule: 'X', statut: 'BOF' })).toBe('statut_invalide')
    expect(validateConstatInput({ intitule: 'X', criticite: 3, source: 'REGULATEUR', statut: 'EN_COURS' })).toBeNull()
  })
  it('échéance invalide', () => {
    expect(validateConstatInput({ intitule: 'X', echeance: 'nope' })).toBe('echeance_invalide')
  })
})

describe('cleanConstatInput', () => {
  it('défauts AUDIT_INTERNE / OUVERT, borne la criticité', () => {
    const c = cleanConstatInput({ intitule: '  Écart  ', criticite: 9, source: 'BOF', statut: 'BOF' })
    expect(c.intitule).toBe('Écart')
    expect(c.criticite).toBe(4)
    expect(c.source).toBe('AUDIT_INTERNE')
    expect(c.statut).toBe('OUVERT')
  })
})

describe('constatTermine / constatEnRetard', () => {
  const now = new Date('2026-07-30T12:00:00Z')
  it('terminé si RESOLU ou ACCEPTE', () => {
    expect(constatTermine('RESOLU')).toBe(true)
    expect(constatTermine('ACCEPTE')).toBe(true)
    expect(constatTermine('OUVERT')).toBe(false)
    expect(constatTermine('EN_COURS')).toBe(false)
  })
  it('en retard : échéance dépassée et non terminé', () => {
    expect(constatEnRetard({ echeance: '2026-07-01', statut: 'OUVERT' }, now)).toBe(true)
    expect(constatEnRetard({ echeance: '2026-08-15', statut: 'OUVERT' }, now)).toBe(false)
    expect(constatEnRetard({ echeance: '2026-07-01', statut: 'RESOLU' }, now)).toBe(false) // terminé
    expect(constatEnRetard({ echeance: null, statut: 'OUVERT' }, now)).toBe(false)
  })
})

describe('synthetiserConstats', () => {
  const now = new Date('2026-07-30T12:00:00Z')
  it('compte ouverts/résolus/retard/critiques et le taux', () => {
    const s = synthetiserConstats([
      { criticite: 4, statut: 'OUVERT', echeance: '2026-07-01' },   // ouvert, en retard, critique
      { criticite: 2, statut: 'EN_COURS', echeance: '2026-09-01' }, // ouvert
      { criticite: 4, statut: 'RESOLU', echeance: '2026-01-01' },   // résolu (pas en retard car terminé)
      { criticite: 1, statut: 'ACCEPTE', echeance: null },          // résolu
    ], now)
    expect(s).toEqual({ total: 4, ouverts: 2, resolus: 2, enRetard: 1, critiques: 1, tauxResolution: 50 })
  })
  it('liste vide', () => {
    expect(synthetiserConstats([], now)).toEqual({ total: 0, ouverts: 0, resolus: 0, enRetard: 0, critiques: 0, tauxResolution: 0 })
  })
})

describe('énumérations', () => {
  it('statuts et sources', () => {
    expect([...MISSION_STATUTS]).toEqual(['PLANIFIEE', 'EN_COURS', 'CLOTUREE'])
    expect([...CONSTAT_STATUTS]).toEqual(['OUVERT', 'EN_COURS', 'RESOLU', 'ACCEPTE'])
    expect([...CONSTAT_SOURCES]).toEqual(['AUDIT_INTERNE', 'REGULATEUR'])
  })

  it('validateMissionInput partial: intitulé non requis si absent', () => {
    expect(validateMissionInput({ dateDebut: '2026-01-01' }, { partial: true })).toBeNull()
    // mais s'il est fourni vide, il reste invalide
    expect(validateMissionInput({ intitule: '  ' }, { partial: true })).toBe('intitule_requis')
    // à la création (non partiel), toujours requis
    expect(validateMissionInput({ dateDebut: '2026-01-01' })).toBe('intitule_requis')
  })

  it('validateConstatInput partial: intitulé non requis si absent', () => {
    expect(validateConstatInput({ statut: 'RESOLU' }, { partial: true })).toBeNull()
    expect(validateConstatInput({ criticite: 9 }, { partial: true })).toBe('criticite_invalide')
    expect(validateConstatInput({ statut: 'RESOLU' })).toBe('intitule_requis')
  })

})
