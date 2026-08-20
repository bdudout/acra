import { describe, it, expect } from 'vitest'
import {
  filtrerRegulateur,
  synthetiserSuiviRegulateur,
  prochaineEcheanceRegulateur,
  suiviRegulateurToCsvRow,
  SUIVI_REGULATEUR_CSV_HEADER,
  type ConstatRegulateur,
} from '../../../lib/suivi-regulateur'

const NOW = new Date('2026-06-01T00:00:00Z')

function c(p: Partial<ConstatRegulateur>): ConstatRegulateur {
  return {
    id: p.id ?? 'x', intitule: p.intitule ?? 'Constat', description: p.description ?? null,
    recommandation: p.recommandation ?? null, criticite: p.criticite ?? null,
    source: p.source ?? 'REGULATEUR', statut: p.statut ?? 'OUVERT',
    echeance: p.echeance ?? null, responsableAction: p.responsableAction ?? null,
    missionIntitule: p.missionIntitule ?? null,
  }
}

describe('filtrerRegulateur', () => {
  it('ne garde que les constats de source REGULATEUR', () => {
    const list = [c({ id: '1', source: 'REGULATEUR' }), c({ id: '2', source: 'AUDIT_INTERNE' })]
    expect(filtrerRegulateur(list).map(x => x.id)).toEqual(['1'])
  })
})

describe('synthetiserSuiviRegulateur', () => {
  it('classe par échéance : échues / sous 30j / à venir / sans échéance', () => {
    const list = [
      c({ id: 'echue', echeance: new Date('2026-05-01') }),           // passée, non terminé
      c({ id: 's30', echeance: new Date('2026-06-20') }),             // dans 19j
      c({ id: 'avenir', echeance: new Date('2026-09-01') }),          // > 30j
      c({ id: 'sans', echeance: null }),                              // sans échéance
      c({ id: 'resolu', echeance: new Date('2026-05-01'), statut: 'RESOLU' }), // terminé → ignoré des buckets
    ]
    const s = synthetiserSuiviRegulateur(list, NOW)
    expect(s.total).toBe(5)
    expect(s.echues).toBe(1)
    expect(s.sous30j).toBe(1)
    expect(s.aVenir).toBe(1)
    expect(s.sansEcheance).toBe(1)
    expect(s.resolus).toBe(1)
    expect(s.ouverts).toBe(4)
  })

  it('compte les critiques non terminés et le taux de résolution', () => {
    const list = [
      c({ id: '1', criticite: 4, statut: 'OUVERT' }),
      c({ id: '2', criticite: 4, statut: 'RESOLU' }),   // terminé → pas critique
      c({ id: '3', criticite: 2, statut: 'ACCEPTE' }),  // terminé
      c({ id: '4', criticite: 3, statut: 'EN_COURS' }),
    ]
    const s = synthetiserSuiviRegulateur(list, NOW)
    expect(s.critiques).toBe(1)
    expect(s.resolus).toBe(2)
    expect(s.tauxResolution).toBe(50)
    expect(s.parCriticite[3]).toBe(1)
    expect(s.parCriticite[4]).toBe(1)
  })

  it('ignore les constats non REGULATEUR passés par erreur (défense)', () => {
    const s = synthetiserSuiviRegulateur([c({ source: 'AUDIT_INTERNE' })], NOW)
    expect(s.total).toBe(0)
  })

  it('taux de résolution à 0 sur liste vide (pas de division par zéro)', () => {
    expect(synthetiserSuiviRegulateur([], NOW).tauxResolution).toBe(0)
  })
})

describe('prochaineEcheanceRegulateur', () => {
  it('renvoie la plus proche échéance FUTURE d’un constat non terminé', () => {
    const list = [
      c({ echeance: new Date('2026-05-01') }),  // passée
      c({ echeance: new Date('2026-08-01') }),
      c({ echeance: new Date('2026-07-01') }),
      c({ echeance: new Date('2026-06-15'), statut: 'RESOLU' }), // terminé, ignoré
    ]
    expect(prochaineEcheanceRegulateur(list, NOW)?.toISOString().slice(0, 10)).toBe('2026-07-01')
  })

  it('renvoie null si aucune échéance future active', () => {
    expect(prochaineEcheanceRegulateur([c({ echeance: null })], NOW)).toBeNull()
  })
})

describe('suiviRegulateurToCsvRow', () => {
  it('produit une ligne alignée sur l’en-tête et neutralise l’injection', () => {
    const row = suiviRegulateurToCsvRow(c({
      intitule: '=cmd()', recommandation: 'Corriger', criticite: 4,
      statut: 'OUVERT', echeance: new Date('2026-07-01'), responsableAction: 'RSSI', missionIntitule: 'Revue ACPR',
    }))
    expect(row.length).toBe(SUIVI_REGULATEUR_CSV_HEADER.length)
    // La cellule commençant par '=' est préfixée d’une apostrophe (anti-injection).
    expect(row.some(cell => typeof cell === 'string' && cell.startsWith("'="))).toBe(true)
  })
})
