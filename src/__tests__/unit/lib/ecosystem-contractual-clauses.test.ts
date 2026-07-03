import { describe, it, expect } from 'vitest'
import {
  CONTRACTUAL_CLAUSE_KEYS,
  CONTRACTUELLE_TYPE,
  isContractualMeasure,
  contractualClauseTitle,
  contractualClauseMeasure,
  groupMeasuresByPartiePrenante,
} from '../../../lib/ecosystem-contractual-clauses'

describe('CONTRACTUAL_CLAUSE_KEYS', () => {
  it('couvre les 7 clauses demandées', () => {
    expect(CONTRACTUAL_CLAUSE_KEYS).toEqual([
      'rgpd', 'securite', 'pas', 'pciPsee', 'reversibilite', 'qos', 'sla',
    ])
  })
})

describe('isContractualMeasure', () => {
  it('vrai seulement pour le type CONTRACTUELLE', () => {
    expect(isContractualMeasure({ type: CONTRACTUELLE_TYPE })).toBe(true)
    expect(isContractualMeasure({ type: 'TECHNIQUE' })).toBe(false)
    expect(isContractualMeasure(null)).toBe(false)
    expect(isContractualMeasure(undefined)).toBe(false)
  })
})

describe('contractualClauseTitle', () => {
  it('sans prestataire : [tag] label', () => {
    expect(contractualClauseTitle('Contrat', 'Clause RGPD')).toBe('[Contrat] Clause RGPD')
    expect(contractualClauseTitle('Contrat', 'SLA', '   ')).toBe('[Contrat] SLA')
  })
  it('avec prestataire : suffixe « — <PP> » (trim)', () => {
    expect(contractualClauseTitle('Contrat', 'SLA', '  OVH  ')).toBe('[Contrat] SLA — OVH')
  })
  it('déterministe (clé de dédup)', () => {
    expect(contractualClauseTitle('Contrat', 'Clause RGPD', 'OVH'))
      .toBe(contractualClauseTitle('Contrat', 'Clause RGPD', 'OVH'))
  })
})

describe('contractualClauseMeasure', () => {
  it('produit une mesure typée CONTRACTUELLE, taguée au prestataire', () => {
    const m = contractualClauseMeasure('Contrat', 'Réversibilité', 'OVH', 'desc')
    expect(m).toMatchObject({
      partiePrenante: 'OVH',
      mesure: '[Contrat] Réversibilité — OVH',
      description: 'desc',
      priorite: 'P2',
      type: 'CONTRACTUELLE',
      statut: 'A_FAIRE',
    })
  })
  it('partiePrenante vide si non fourni', () => {
    expect(contractualClauseMeasure('Contrat', 'SLA').partiePrenante).toBe('')
  })
})

describe('groupMeasuresByPartiePrenante', () => {
  it('regroupe par prestataire en conservant l\'ordre, sans-PP sous ""', () => {
    const g = groupMeasuresByPartiePrenante([
      { partiePrenante: 'OVH', mesure: 'a' },
      { partiePrenante: '', mesure: 'b' },
      { partiePrenante: 'OVH', mesure: 'c' },
      { partiePrenante: '  AWS ', mesure: 'd' },
    ])
    expect(g.map(x => x.partiePrenante)).toEqual(['OVH', '', 'AWS'])
    expect(g[0].measures.map(m => m.mesure)).toEqual(['a', 'c'])
    expect(g[2].partiePrenante).toBe('AWS')
  })
})
