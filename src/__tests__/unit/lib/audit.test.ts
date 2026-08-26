import { describe, it, expect } from 'vitest'
import {
  validateMissionInput, cleanMissionInput, transitionMissionAutorisee, prochaineFenetreMission,
  filtrerMissions, filtrerConstats,
  validateConstatInput, cleanConstatInput, constatTermine, constatEnRetard, synthetiserConstats,
  MISSION_STATUTS, CONSTAT_STATUTS, CONSTAT_SOURCES, niveauControle, SOURCE_NIVEAU,
} from '@/lib/audit'

describe('4ᵉ niveau — source de constat & niveau de contrôle', () => {
  it('CONSTAT_SOURCES inclut l\'auditeur externe (4ᵉ niveau)', () => {
    expect([...CONSTAT_SOURCES]).toEqual(['AUDIT_INTERNE', 'REGULATEUR', 'AUDITEUR_EXTERNE'])
  })
  it('niveauControle : audit interne = N3 ; régulateur & auditeur externe = N4', () => {
    expect(niveauControle('AUDIT_INTERNE')).toBe('N3')
    expect(niveauControle('REGULATEUR')).toBe('N4')
    expect(niveauControle('AUDITEUR_EXTERNE')).toBe('N4')
    expect(SOURCE_NIVEAU.AUDITEUR_EXTERNE).toBe('N4')
  })
  it('cleanConstatInput accepte la nouvelle source', () => {
    expect(cleanConstatInput({ intitule: 'X', source: 'AUDITEUR_EXTERNE' }).source).toBe('AUDITEUR_EXTERNE')
    expect(validateConstatInput({ intitule: 'X', source: 'AUDITEUR_EXTERNE' })).toBeNull()
    expect(validateConstatInput({ intitule: 'X', source: 'BOGUS' })).toBe('source_invalide')
  })
})

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
  it('programme (checklist), cotation et périmètre audité (N3→N1/N2)', () => {
    const m = cleanMissionInput({
      intitule: 'Audit accès',
      programme: ['Revue des habilitations', '  Revue des habilitations  ', '', 'Test MFA'],
      programmeResultats: [{ label: 'Revue des habilitations', statut: 'KO', commentaire: '  2 écarts  ' }, { label: 'x', statut: 'BOGUS' }],
      processusIds: ['p1', 'p1', ' p2 '],
      controleIds: ['c1', 3, 'c2'],
    })
    expect(m.programme).toEqual(['Revue des habilitations', 'Test MFA'])
    expect(m.programmeResultats).toEqual([{ label: 'Revue des habilitations', statut: 'KO', commentaire: '2 écarts' }])
    expect(m.processusIds).toEqual(['p1', 'p2'])
    expect(m.controleIds).toEqual(['c1', 'c2'])
  })
  it('défauts : programme et périmètre vides', () => {
    const m = cleanMissionInput({ intitule: 'X' })
    expect(m.programme).toEqual([])
    expect(m.programmeResultats).toEqual([])
    expect(m.processusIds).toEqual([])
    expect(m.controleIds).toEqual([])
  })
})

describe('mission — type & récurrence (plan pluriannuel)', () => {
  it('type et recurrence : valeurs connues, défauts sinon', () => {
    expect(cleanMissionInput({ intitule: 'X', type: 'PERIODIQUE', recurrence: 'ANNUEL' })).toMatchObject({ type: 'PERIODIQUE', recurrence: 'ANNUEL' })
    expect(cleanMissionInput({ intitule: 'X', type: 'BOGUS', recurrence: 'BOGUS' })).toMatchObject({ type: 'THEMATIQUE', recurrence: 'NONE' })
    expect(cleanMissionInput({ intitule: 'X' })).toMatchObject({ type: 'THEMATIQUE', recurrence: 'NONE' })
  })
  it('prochaineFenetreMission décale la fenêtre selon la récurrence (en années)', () => {
    expect(prochaineFenetreMission('NONE', '2026-01-01', '2026-02-01')).toBeNull()
    expect(prochaineFenetreMission('ANNUEL', null, '2026-02-01')).toBeNull() // fenêtre incomplète
    const a = prochaineFenetreMission('ANNUEL', '2026-01-01', '2026-02-01')!
    expect(a.dateDebut.toISOString().slice(0, 10)).toBe('2027-01-01')
    expect(a.dateFin.toISOString().slice(0, 10)).toBe('2027-02-01')
    const t = prochaineFenetreMission('TRIENNAL', '2026-01-15', '2026-03-15')!
    expect(t.dateDebut.toISOString().slice(0, 10)).toBe('2029-01-15')
  })
})

describe('filtrerMissions', () => {
  const list = [
    { intitule: 'Audit des accès', responsable: 'Alice', statut: 'EN_COURS', type: 'THEMATIQUE' },
    { intitule: 'Revue périodique SI', responsable: 'Bob', statut: 'PLANIFIEE', type: 'PERIODIQUE' },
    { intitule: 'Audit clôturé', responsable: null, statut: 'CLOTUREE', type: 'THEMATIQUE' },
  ]
  it('recherche insensible casse/accents (intitulé + responsable)', () => {
    expect(filtrerMissions(list, { q: 'acces' }).map(m => m.responsable)).toEqual(['Alice'])
    expect(filtrerMissions(list, { q: 'BOB' }).length).toBe(1)
  })
  it('facettes statut et type', () => {
    expect(filtrerMissions(list, { statut: 'CLOTUREE' }).length).toBe(1)
    expect(filtrerMissions(list, { type: 'PERIODIQUE' }).length).toBe(1)
  })
  it('sans filtre → inchangé', () => { expect(filtrerMissions(list, {}).length).toBe(3) })
})

describe('filtrerConstats', () => {
  const list = [
    { intitule: 'Écart habilitations', description: 'comptes dormants', statut: 'OUVERT', criticite: 4, source: 'AUDIT_INTERNE' },
    { intitule: 'Retard patch', description: null, statut: 'RESOLU', criticite: 2, source: 'AUDIT_INTERNE' },
    { intitule: 'Demande ACPR', description: 'lettre de suite', statut: 'EN_COURS', criticite: 3, source: 'REGULATEUR' },
  ]
  it('recherche, statut, criticité, source', () => {
    expect(filtrerConstats(list, { q: 'dormants' }).length).toBe(1)
    expect(filtrerConstats(list, { statut: 'RESOLU' }).length).toBe(1)
    expect(filtrerConstats(list, { criticite: '4' }).length).toBe(1)
    expect(filtrerConstats(list, { source: 'REGULATEUR' }).map(c => c.intitule)).toEqual(['Demande ACPR'])
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
    expect([...CONSTAT_SOURCES]).toEqual(['AUDIT_INTERNE', 'REGULATEUR', 'AUDITEUR_EXTERNE'])
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
