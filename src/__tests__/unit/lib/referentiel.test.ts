import { describe, it, expect } from 'vitest'
import {
  REFERENTIEL_TYPES, slugifyCode, parseExigences,
  validateReferentielInput, cleanReferentielInput,
} from '../../../lib/referentiel'

describe('slugifyCode', () => {
  it('normalise en majuscules alphanumériques + tirets', () => {
    expect(slugifyCode('PSSI 2026')).toBe('PSSI-2026')
    expect(slugifyCode('  politique Accès  ')).toBe('POLITIQUE-ACCES')
    expect(slugifyCode('a//b__c')).toBe('A-B-C')
  })
})

describe('parseExigences', () => {
  it('lit une exigence par ligne « ref | intitulé | catégorie | type »', () => {
    const ex = parseExigences('PSSI-1 | Politique validée | Gouvernance | ORGANISATIONNELLE\nPSSI-2 | Chiffrement des portables | Technique | TECHNOLOGIQUE')
    expect(ex).toHaveLength(2)
    expect(ex[0]).toMatchObject({ ref: 'PSSI-1', nom: 'Politique validée', categorie: 'Gouvernance', type: 'ORGANISATIONNELLE' })
    expect(ex[1].type).toBe('TECHNOLOGIQUE')
  })

  it('tolère les séparateurs tab, ignore lignes vides et commentaires #', () => {
    const ex = parseExigences('# en-tête\nPSSI-1\tRègle A\n\n   \nPSSI-2\tRègle B')
    expect(ex.map(e => e.ref)).toEqual(['PSSI-1', 'PSSI-2'])
  })

  it('applique un type par défaut et déduplique par ref (première gagnante)', () => {
    const ex = parseExigences('R1 | A\nR1 | A bis\nR2 | B | Cat | TYPE_INCONNU')
    expect(ex.map(e => e.ref)).toEqual(['R1', 'R2'])
    expect(ex[0].nom).toBe('A')
    expect(ex[0].type).toBe('ORGANISATIONNELLE') // défaut
    expect(ex[1].type).toBe('ORGANISATIONNELLE') // type inconnu → défaut
  })

  it('ignore une ligne sans intitulé exploitable mais garde la ref seule', () => {
    const ex = parseExigences('R1')
    expect(ex).toEqual([{ ref: 'R1', nom: 'R1', description: '', categorie: '', type: 'ORGANISATIONNELLE' }])
  })
})

describe('validateReferentielInput', () => {
  it('exige un code et un nom', () => {
    expect(validateReferentielInput({ code: '', nom: 'x' })).toBe('code_requis')
    expect(validateReferentielInput({ code: 'PSSI', nom: '  ' })).toBe('nom_requis')
    expect(validateReferentielInput({ code: 'PSSI', nom: 'Ma PSSI' })).toBeNull()
  })

  it('rejette un type hors liste', () => {
    expect(validateReferentielInput({ code: 'X', nom: 'X', type: 'ZZZ' })).toBe('type_invalide')
    expect(validateReferentielInput({ code: 'X', nom: 'X', type: 'PSSI' })).toBeNull()
  })

  it('rejette une exigence sans ref', () => {
    expect(validateReferentielInput({ code: 'X', nom: 'X', exigences: [{ ref: '', nom: 'a' }] })).toBe('exigence_ref_requise')
  })
})

describe('cleanReferentielInput', () => {
  it('slugifie le code, borne le type, déduplique les exigences', () => {
    const c = cleanReferentielInput({
      code: 'pssi 2026', nom: '  Ma PSSI ', type: 'PSSI', version: ' v1 ', description: '',
      exigences: [{ ref: ' a ', nom: 'A' }, { ref: 'a', nom: 'A2' }, { ref: 'b', nom: 'B', type: 'TECHNOLOGIQUE' }],
    })
    expect(c.code).toBe('PSSI-2026')
    expect(c.nom).toBe('Ma PSSI')
    expect(c.type).toBe('PSSI')
    expect(c.version).toBe('v1')
    expect(c.exigences.map(e => e.ref)).toEqual(['a', 'b'])
    expect(c.exigences[1].type).toBe('TECHNOLOGIQUE')
  })

  it('type inconnu → CUSTOM par défaut', () => {
    expect(cleanReferentielInput({ code: 'x', nom: 'x', type: 'ZZZ' }).type).toBe('CUSTOM')
  })

  it('expose la liste des types', () => {
    expect(REFERENTIEL_TYPES).toContain('PSSI')
    expect(REFERENTIEL_TYPES).toContain('CUSTOM')
  })
})
