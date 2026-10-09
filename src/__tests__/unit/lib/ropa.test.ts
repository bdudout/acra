import { describe, it, expect } from 'vitest'
import {
  BASES_LEGALES,
  sanitizeTraitement,
  champsManquantsArt30,
  piaRequis,
  criteresAipd,
  CRITERES_AIPD,
  evaluerTraitement,
  type Traitement,
} from '@/lib/ropa'

// Base : un traitement RGPD art. 30 complet et non sensible.
const complet = (): Traitement => ({
  nom: 'Gestion de la paie',
  finalite: 'Verser les salaires et gérer les bulletins',
  baseLegale: 'obligation_legale',
  categoriesPersonnes: ['salariés'],
  categoriesDonnees: ['identité', 'coordonnées bancaires (RIB)'],
  destinataires: ['service RH', 'URSSAF'],
  transfertHorsUE: false,
  dureeConservation: '5 ans après le départ',
  mesuresSecurite: ['chiffrement', 'contrôle d’accès'],
  grandeEchelle: false,
  surveillanceSystematique: false,
})

describe('BASES_LEGALES (art. 6 RGPD)', () => {
  it('contient les 6 bases légales', () => {
    expect(BASES_LEGALES).toContain('consentement')
    expect(BASES_LEGALES).toContain('interet_legitime')
    expect(BASES_LEGALES).toHaveLength(6)
  })
})

describe('champsManquantsArt30 (complétude du registre)', () => {
  it('un traitement complet → aucun champ manquant', () => {
    expect(champsManquantsArt30(complet())).toEqual([])
  })
  it('signale chaque champ obligatoire art. 30 §1 manquant', () => {
    const vide: Traitement = {
      nom: '', finalite: '', baseLegale: '', categoriesPersonnes: [], categoriesDonnees: [],
      destinataires: [], transfertHorsUE: false, dureeConservation: '', mesuresSecurite: [],
    }
    const m = champsManquantsArt30(vide)
    for (const champ of ['finalite', 'categoriesPersonnes', 'categoriesDonnees', 'destinataires', 'dureeConservation', 'mesuresSecurite']) {
      expect(m).toContain(champ)
    }
  })
  it('un transfert hors UE sans garanties est signalé (art. 44-46)', () => {
    const t = { ...complet(), transfertHorsUE: true, paysTransfert: 'États-Unis', garantiesTransfert: '' }
    expect(champsManquantsArt30(t)).toContain('garantiesTransfert')
    const t2 = { ...complet(), transfertHorsUE: true, paysTransfert: 'États-Unis', garantiesTransfert: 'clauses contractuelles types' }
    expect(champsManquantsArt30(t2)).not.toContain('garantiesTransfert')
  })
})

describe('AIPD — critères des lignes directrices WP248 rév. 01 (CEPD)', () => {
  it('9 critères, dans l’ordre des lignes directrices', () => {
    expect(CRITERES_AIPD).toEqual(['EVALUATION', 'DECISION_AUTOMATISEE', 'SURVEILLANCE', 'DONNEES_SENSIBLES', 'GRANDE_ECHELLE', 'CROISEMENT', 'PERSONNES_VULNERABLES', 'INNOVATION', 'EXCLUSION_DROIT'])
  })
  it('critères retenus : cochés par le DPO + déduits (catégories particulières art. 9, grande échelle, surveillance), sans doublon', () => {
    const t = { ...complet(), categoriesDonnees: ['données de santé'], grandeEchelle: true, criteresAipd: ['PERSONNES_VULNERABLES', 'GRANDE_ECHELLE', 'INCONNU'] }
    expect(criteresAipd(t)).toEqual(['DONNEES_SENSIBLES', 'GRANDE_ECHELLE', 'PERSONNES_VULNERABLES'])
  })
  it('deux critères ou plus → AIPD requise (« dans la plupart des cas ») ; ex. notation de clients à grande échelle', () => {
    const clients = { ...complet(), categoriesPersonnes: ['clients'] }
    const r = piaRequis({ ...clients, grandeEchelle: true, criteresAipd: ['EVALUATION'] })
    expect(r).toEqual({ requis: true, niveau: 'REQUISE', motifs: ['EVALUATION', 'GRANDE_ECHELLE'] })
    expect(piaRequis({ ...clients, grandeEchelle: true, surveillanceSystematique: true }).niveau).toBe('REQUISE')
  })
  it('un seul critère → AIPD à examiner (un critère peut suffire selon le cas) ; aucun → non requise', () => {
    const clients = { ...complet(), categoriesPersonnes: ['clients'] }
    expect(piaRequis({ ...clients, categoriesDonnees: ['données de santé des patients'] })).toEqual({ requis: false, niveau: 'A_EXAMINER', motifs: ['DONNEES_SENSIBLES'] })
    expect(piaRequis(clients)).toEqual({ requis: false, niveau: 'NON', motifs: [] })
  })
  it('personnes vulnérables déduites des catégories de personnes (salariés, patients… — recette n° 12)', () => {
    expect(criteresAipd(complet())).toEqual(['PERSONNES_VULNERABLES'])
    expect(piaRequis({ ...complet(), categoriesPersonnes: ['patients', 'mineurs'], categoriesDonnees: ['dossier médical'] })).toEqual({ requis: true, niveau: 'REQUISE', motifs: ['DONNEES_SENSIBLES', 'PERSONNES_VULNERABLES'] })
  })
})

describe('sanitizeTraitement (normalisation d’entrée)', () => {
  it('borne les chaînes, force les tableaux, valide la base légale', () => {
    const t = sanitizeTraitement({
      nom: 'x'.repeat(500), finalite: 'f', baseLegale: 'INVALIDE',
      categoriesDonnees: 'pas un tableau', destinataires: ['a', 2, null, 'b'],
      transfertHorsUE: 'oui', dureeConservation: 'd', mesuresSecurite: ['m'],
    })
    expect(t.nom.length).toBeLessThanOrEqual(200)
    expect(t.baseLegale).toBe('') // base invalide → vide
    expect(Array.isArray(t.categoriesDonnees)).toBe(true)
    expect(t.destinataires).toEqual(['a', 'b']) // non-strings écartés
    expect(t.transfertHorsUE).toBe(true) // coercition booléenne
  })
  it('entrée non-objet → traitement vide sûr', () => {
    const t = sanitizeTraitement(null)
    expect(t.nom).toBe('')
    expect(t.categoriesDonnees).toEqual([])
  })
})

describe('evaluerTraitement (synthèse pour le DPO)', () => {
  it('assemble complétude + PIA', () => {
    const r = evaluerTraitement({ ...complet(), categoriesDonnees: ['données de santé'], grandeEchelle: true })
    expect(r.pia.requis).toBe(true)
    expect(r.complet).toBe(true) // tous les champs art.30 présents
    expect(r.champsManquants).toEqual([])
  })
  it('un traitement incomplet est signalé', () => {
    const r = evaluerTraitement({ ...complet(), dureeConservation: '' })
    expect(r.complet).toBe(false)
    expect(r.champsManquants).toContain('dureeConservation')
  })
})
