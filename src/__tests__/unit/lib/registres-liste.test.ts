// Règles des listes paginées côté serveur du registre des risques et des incidents (lot V1).
import { describe, it, expect } from 'vitest'
import { baseRisques, filtrerRisques, lireNiveau, syntheseRisques, valeurTriRisque, cleColonneRisque, type RisqueLeger } from '@/lib/risk-items-liste'
import { baseIncidents, filtrerIncidents, lireStatut, syntheseIncidents, valeurTriIncident, texteRisques, type IncidentLeger } from '@/lib/incidents-liste'
import { trier } from '@/lib/pagination'

const R = (o: Partial<RisqueLeger> & { id: string }): RisqueLeger => ({
  intitule: o.id, taxonomieCode: null, processusNom: null, entite: null, proprietaire: null, statut: 'IDENTIFIE', niveauInherent: null, niveauResiduel: null, ...o,
})
const I = (o: Partial<IncidentLeger> & { id: string }): IncidentLeger => ({
  intitule: o.id, statut: 'DECLARE', taxonomieCode: null, processusId: null, processusNom: null, entite: null, entiteId: null,
  dateSurvenance: null, dateDetection: null, perteNette: null, risquesTexte: '', ...o,
})

describe('registre des risques — liste paginée', () => {
  const rows = [
    R({ id: 'a', niveauResiduel: 16, taxonomieCode: 'BALE_1', statut: 'TRAITE', entite: 'DSI' }),
    R({ id: 'b', niveauResiduel: 6, processusNom: 'Paiements', entite: 'DSI' }),
    R({ id: 'c', niveauResiduel: null, proprietaire: 'Élodie Martin', entite: 'RH' }),
  ]
  it('palier de niveau : deep-link sans casse ; risques non cotés exclus du palier', () => {
    expect(lireNiveau('ELEVE')).toBe('eleve'); expect(lireNiveau('x')).toBe('')
    expect(baseRisques(rows, 'eleve').map(r => r.id)).toEqual(['a'])
    expect(baseRisques(rows, 'moyen').map(r => r.id)).toEqual(['b'])
    expect(baseRisques(rows, '')).toHaveLength(3)
  })
  it('filtres de colonnes par clé (catégorie vide = clé \'\') et recherche sans accents', () => {
    expect(filtrerRisques(rows, { q: '', colonnes: { category: new Set(['']) } }).map(r => r.id)).toEqual(['b', 'c'])
    expect(filtrerRisques(rows, { q: '', colonnes: { process: new Set(['Paiements']), statut: new Set(['IDENTIFIE']) } }).map(r => r.id)).toEqual(['b'])
    expect(filtrerRisques(rows, { q: 'elodie', colonnes: {} }).map(r => r.id)).toEqual(['c'])
    expect(cleColonneRisque(rows[1], 'process')).toBe('Paiements')
  })
  it('tri : statut par rang métier, niveaux absents en fin ; ordre par défaut inchangé', () => {
    expect(trier(rows, valeurTriRisque('residual')!, 'asc').map(r => r.id)).toEqual(['b', 'a', 'c'])
    expect(trier(rows, valeurTriRisque('statut')!, 'asc').map(r => r.id)).toEqual(['b', 'c', 'a'])
    expect(valeurTriRisque('defaut')).toBeNull()
  })
  it('synthèse : total et entité fréquente sur tout le registre, clés distinctes sur la base', () => {
    const s = syntheseRisques(rows, baseRisques(rows, 'eleve'))
    expect(s).toEqual({ total: 3, entiteFrequente: 'DSI', valeurs: { category: ['BALE_1'], process: [''], statut: ['TRAITE'] } })
  })
})

describe('incidents — liste paginée', () => {
  const entites = [
    { id: 'dsi', nom: 'Direction des SI', type: 'DIRECTION', alias: ['DSI'], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null },
    { id: 'ret', nom: 'Réseaux', type: 'SERVICE', alias: [], codeExterne: null, parentId: 'dsi', source: 'MANUEL', valideAu: null },
  ]
  const rows = [
    I({ id: 'i1', entiteId: 'ret', perteNette: 100, risquesTexte: texteRisques([{ intitule: 'Fraude' }, { intitule: 'Panne' }]) }),
    I({ id: 'i2', entite: 'DSI', statut: 'QUALIFIE', perteNette: 50 }),
    I({ id: 'i3', entite: 'Achats', statut: 'CLOTURE' }),
  ]
  it('statut du deep-link sans casse ; entité avec ou sans sous-entités', () => {
    expect(lireStatut('declare')).toBe('DECLARE'); expect(lireStatut('NOPE')).toBe('')
    const f = { statut: '', entite: 'dsi', sousEntites: true, entites }
    expect(baseIncidents(rows, f).map(i => i.id)).toEqual(['i1', 'i2'])
    expect(baseIncidents(rows, { ...f, sousEntites: false }).map(i => i.id)).toEqual(['i2'])
    expect(baseIncidents(rows, { ...f, entite: '', statut: 'CLOTURE' }).map(i => i.id)).toEqual(['i3'])
  })
  it('colonne Risques = intitulés joints ; recherche dans les risques', () => {
    expect(rows[0].risquesTexte).toBe('Fraude · Panne')
    expect(filtrerIncidents(rows, { q: '', colonnes: { risque: new Set(['Fraude · Panne']) } }).map(i => i.id)).toEqual(['i1'])
    expect(filtrerIncidents(rows, { q: 'panne', colonnes: {} }).map(i => i.id)).toEqual(['i1'])
  })
  it('tri par perte (absentes en fin) et synthèse sur tous les incidents', () => {
    expect(trier(rows, valeurTriIncident('perte')!, 'asc').map(i => i.id)).toEqual(['i2', 'i1', 'i3'])
    const s = syntheseIncidents(rows, rows.slice(1))
    expect(s).toMatchObject({ total: 3, aQualifier: 1, perteNetteTotale: 150, valeurs: { statut: ['CLOTURE', 'QUALIFIE'], risque: [''] } })
  })
})
