import { describe, expect, it } from 'vitest'
import { planTiersImport } from '@/lib/projet360'

const src = [
  { nom: 'Hébergeur cloud', type: 'FOURNISSEUR', description: 'IaaS', tierId: 't1', dependance: 4, penetration: 3, maturite: 4, confiance: 3, critique: true, rang: 1 },
  { nom: 'Prestataire de paie', type: 'PRESTATAIRE', description: null, tierId: null, dependance: 3, penetration: 4, maturite: 2, confiance: 2, critique: false, rang: 1 },
  { nom: 'Sous-traitant du prestataire', type: 'PRESTATAIRE', description: null, tierId: null, dependance: 2, penetration: 2, maturite: 2, confiance: 2, critique: false, rang: 2 },
]

describe('import des tiers avec les risques cyber (projet 360)', () => {
  it('reprend les tiers de l’analyse source (identité, type, cotation, criticité), en rang 1', () => {
    const rows = planTiersImport({ analyseId: 'p', source: src, existants: [] })
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ analyseId: 'p', nom: 'Hébergeur cloud', type: 'FOURNISSEUR', tierId: 't1', dependance: 4, penetration: 3, maturite: 4, confiance: 3, exposition: 12, fiabilite: 12, critique: true, rang: 1 })
    expect(rows.every(r => r.rang === 1 && r.parentCle === null)).toBe(true)
  })
  it('sans doublon : un tiers déjà présent (même identité ou même nom, casse et espaces ignorés) n’est pas recréé', () => {
    const rows = planTiersImport({ analyseId: 'p', source: src, existants: [{ nom: 'autre nom', tierId: 't1' }, { nom: '  PRESTATAIRE de paie ', tierId: null }] })
    expect(rows.map(r => r.nom)).toEqual(['Sous-traitant du prestataire'])
  })
  it('un type inconnu retombe sur « prestataire »', () => {
    expect(planTiersImport({ analyseId: 'p', source: [{ ...src[1], nom: 'X', type: 'INVENTE' }], existants: [] })[0].type).toBe('PRESTATAIRE')
  })
})
