// Stratégie (lot S1b) : droits affichés par rôle, mode d'édition du cadre selon statut et figeage, message d'erreur
// i18n et rendu lisible de l'avant / après d'une évolution.
import { describe, expect, it } from 'vitest'
import { droitsStrategie, modeEditionCadre, messageErreurStrategie, resumeValeurs } from '@/lib/strategie-ui'

describe('droitsStrategie', () => {
  it('AUDITEUR : lecture seule ; LECTEUR : aucun droit', () => {
    expect(droitsStrategie('AUDITEUR')).toEqual({ voir: true, rediger: false, valider: false, rattacher: false })
    expect(droitsStrategie('LECTEUR')).toEqual({ voir: false, rediger: false, valider: false, rattacher: false })
  })
  it('RSSI rédige, valide et rattache ; DIRECTION_METIER valide sans rédiger ; CONTROLEUR rattache', () => {
    expect(droitsStrategie('RSSI')).toEqual({ voir: true, rediger: true, valider: true, rattacher: true })
    expect(droitsStrategie('DIRECTION_METIER')).toMatchObject({ rediger: false, valider: true })
    expect(droitsStrategie('CONTROLEUR')).toMatchObject({ rediger: false, valider: false, rattacher: true })
  })
})

describe('modeEditionCadre', () => {
  it('BROUILLON libre ; VALIDEE figé ou justifié ; ARCHIVEE lecture', () => {
    expect(modeEditionCadre('BROUILLON', true)).toBe('libre')
    expect(modeEditionCadre('VALIDEE', true)).toBe('fige')
    expect(modeEditionCadre('VALIDEE', false)).toBe('justifiee')
    expect(modeEditionCadre('ARCHIVEE', false)).toBe('lecture')
  })
})

describe('messageErreurStrategie', () => {
  it('code connu → libellé ; inconnu → défaut', () => {
    const e = { cadre_fige: 'Figé' }
    expect(messageErreurStrategie('cadre_fige', e, 'Échec')).toBe('Figé')
    expect(messageErreurStrategie('zzz', e, 'Échec')).toBe('Échec')
    expect(messageErreurStrategie(undefined, e, 'Échec')).toBe('Échec')
  })
})

describe('resumeValeurs', () => {
  const ctx = {
    champs: { titre: 'Titre', axeId: 'Axe', sourceType: 'Source', sourceId: 'Élément', identifiantsExternes: 'Identifiants externes', echeance: 'Échéance', cible: 'Cible' },
    sources: { AUDIT: 'Recommandation d’audit' }, provenances: { MANUEL: 'Manuel' },
    axes: new Map([['a1', 'Protéger']]), elements: new Map([['AUDIT:c1', 'Revue des accès']]), locale: 'fr', gabarit: '{label} : {value}',
  }
  it('libellés des champs, axe et élément nommés, identifiants et dates lisibles, vide → —', () => {
    expect(resumeValeurs({ axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1' }, ctx)).toBe('Axe : Protéger · Source : Recommandation d’audit · Élément : Revue des accès')
    expect(resumeValeurs({ identifiantsExternes: [{ systeme: 'SAP', valeur: '4102' }], cible: null }, ctx)).toBe('Identifiants externes : SAP 4102 · Cible : —')
    expect(resumeValeurs({ echeance: '2027-06-30T00:00:00.000Z' }, ctx)).toMatch(/^Échéance : 30\/06\/2027$/)
    expect(resumeValeurs(null, ctx)).toBe('—')
  })
  it('gabarit « libellé / valeur » propre à la langue', () => {
    expect(resumeValeurs({ cible: '100 %' }, { ...ctx, gabarit: '{label}: {value}' })).toBe('Cible: 100 %')
  })
})
