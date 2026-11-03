// Double validation (quatre yeux) : quand une action l'exige, et qui peut décider (jamais le demandeur ; droit requis).
import { describe, expect, it } from 'vitest'
import { risquesHorsAppetit, contratTicCritique, risqueRegistreHorsAppetit, controlerDecision } from '@/lib/double-validation'

const appetit = { seuilGlobal: 8, parCategorie: { FRAUDE: 4 } }

describe('déclencheurs', () => {
  it('analyse : risques résiduels au-dessus du seuil applicable (catégorie, sinon global)', () => {
    expect(risquesHorsAppetit([{ niveauResiduel: 9, taxonomieCode: null }, { niveauResiduel: 6, taxonomieCode: null }], appetit)).toBe(1)
    expect(risquesHorsAppetit([{ niveauResiduel: 6, taxonomieCode: 'FRAUDE' }], appetit)).toBe(1)
    expect(risquesHorsAppetit([{ niveauResiduel: null, taxonomieCode: null }], appetit)).toBe(0)
    expect(risquesHorsAppetit([{ niveauResiduel: 25, taxonomieCode: null }], { seuilGlobal: null, parCategorie: {} })).toBe(0)
  })
  it('registre : résiduel = gravité × vraisemblance résiduelles', () => {
    expect(risqueRegistreHorsAppetit({ graviteResiduelle: 3, vraisemblanceResiduelle: 3, taxonomieCode: null }, appetit)).toBe(true)
    expect(risqueRegistreHorsAppetit({ graviteResiduelle: 2, vraisemblanceResiduelle: 4, taxonomieCode: null }, appetit)).toBe(false)
    expect(risqueRegistreHorsAppetit({ graviteResiduelle: null, vraisemblanceResiduelle: 4, taxonomieCode: null }, appetit)).toBe(false)
  })
  it('contrat TIC : critique ou important (fonction critique ou importante au sens DORA)', () => {
    expect(contratTicCritique('CRITIQUE')).toBe(true)
    expect(contratTicCritique('IMPORTANTE')).toBe(true)
    expect(contratTicCritique('NON_CRITIQUE')).toBe(false)
  })
})

describe('controlerDecision', () => {
  const base = { statut: 'EN_ATTENTE', demandeurId: 'alice', valideurId: 'bob', decision: 'APPROUVER' as const, autorise: true }
  it('une autre personne habilitée approuve', () => {
    expect(controlerDecision(base)).toBeNull()
  })
  it('le demandeur ne peut ni approuver ni rejeter sa propre demande, mais peut l’annuler', () => {
    expect(controlerDecision({ ...base, valideurId: 'alice' })).toBe('auto_validation_interdite')
    expect(controlerDecision({ ...base, valideurId: 'alice', decision: 'REJETER', motif: 'x' })).toBe('auto_validation_interdite')
    expect(controlerDecision({ ...base, valideurId: 'alice', decision: 'ANNULER', autorise: false })).toBeNull()
  })
  it('droit requis pour approuver ou rejeter ; seul le demandeur annule', () => {
    expect(controlerDecision({ ...base, autorise: false })).toBe('droits_insuffisants')
    expect(controlerDecision({ ...base, decision: 'ANNULER' })).toBe('annulation_reservee_au_demandeur')
  })
  it('un rejet doit être motivé ; une demande déjà tranchée ne bouge plus', () => {
    expect(controlerDecision({ ...base, decision: 'REJETER' })).toBe('motif_requis')
    expect(controlerDecision({ ...base, statut: 'APPROUVEE' })).toBe('demande_close')
  })
})

import { statutCreationRegistre } from '@/lib/double-validation'
describe('statutCreationRegistre (création directe au statut ACCEPTE)', () => {
  const appetit2 = { seuilGlobal: 6, parCategorie: {} }
  const r = { intitule: 'x', statut: 'ACCEPTE', graviteResiduelle: 3, vraisemblanceResiduelle: 3, taxonomieCode: null }
  it('hors appétit, option active : enregistré EVALUE + demande', () => {
    expect(statutCreationRegistre(r, true, appetit2)).toEqual({ item: { ...r, statut: 'EVALUE' }, demander: true })
  })
  it('dans l’appétit, option inactive ou autre statut : inchangé', () => {
    expect(statutCreationRegistre({ ...r, graviteResiduelle: 2 }, true, appetit2).demander).toBe(false)
    expect(statutCreationRegistre(r, false, appetit2)).toEqual({ item: r, demander: false })
    expect(statutCreationRegistre({ ...r, statut: 'TRAITE' }, true, appetit2).demander).toBe(false)
  })
})
