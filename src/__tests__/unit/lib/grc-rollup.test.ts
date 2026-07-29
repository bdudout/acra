import { describe, it, expect } from 'vitest'
import { postureBucket, rollupRisks, rollupByOrg, type RiskLite, type ScopedAction } from '@/lib/grc-rollup'

describe('postureBucket', () => {
  it('privilégie le résiduel, retombe sur l\'inhérent, sinon non coté', () => {
    expect(postureBucket({ organizationId: 'o', niveauInherent: 20, niveauResiduel: 4 })).toBe('faible') // résiduel 4
    expect(postureBucket({ organizationId: 'o', niveauInherent: 20, niveauResiduel: null })).toBe('eleve') // inhérent 20
    expect(postureBucket({ organizationId: 'o', niveauInherent: null, niveauResiduel: null })).toBe('nonCote')
    expect(postureBucket({ organizationId: 'o', niveauInherent: null, niveauResiduel: 9 })).toBe('moyen') // résiduel 9
  })
})

describe('rollupRisks', () => {
  it('consolide les paliers', () => {
    const risks: RiskLite[] = [
      { organizationId: 'a', niveauInherent: 20, niveauResiduel: 16 }, // eleve
      { organizationId: 'a', niveauInherent: 9, niveauResiduel: null }, // moyen (inhérent 9)
      { organizationId: 'b', niveauInherent: 4, niveauResiduel: 2 },   // faible
      { organizationId: 'b', niveauInherent: null, niveauResiduel: null }, // nonCote
    ]
    expect(rollupRisks(risks)).toEqual({ total: 4, eleve: 1, moyen: 1, faible: 1, nonCote: 1 })
  })
})

describe('rollupByOrg', () => {
  const orgs = [{ id: 'a', nom: 'Direction A' }, { id: 'b', nom: 'Direction B' }, { id: 'c', nom: 'Direction C' }]
  const now = new Date('2026-07-29T12:00:00Z')
  const risks: RiskLite[] = [
    { organizationId: 'a', niveauInherent: 20, niveauResiduel: 16 }, // a: 1 eleve
    { organizationId: 'b', niveauInherent: 6, niveauResiduel: 6 },   // b: 1 moyen
    { organizationId: 'b', niveauInherent: 6, niveauResiduel: 6 },   // b: 1 moyen
  ]
  const actions: ScopedAction[] = [
    { organizationId: 'b', statut: 'A_FAIRE', echeance: '2026-07-01' }, // b: en retard
  ]
  it('une ligne par org ayant des risques, triée par exposition', () => {
    const rows = rollupByOrg(orgs, risks, actions, now)
    expect(rows.map(r => r.orgId)).toEqual(['a', 'b']) // c absent (aucun risque) ; a avant b (élevé)
    expect(rows[0].risques).toEqual({ total: 1, eleve: 1, moyen: 0, faible: 0, nonCote: 0 })
    expect(rows[1].risques.moyen).toBe(2)
    expect(rows[1].actions.enRetard).toBe(1)
    expect(rows[1].orgNom).toBe('Direction B')
  })
  it('à exposition risque égale, l\'org avec des actions en retard passe devant', () => {
    const rows = rollupByOrg(
      [{ id: 'x', nom: 'X' }, { id: 'y', nom: 'Y' }],
      [{ organizationId: 'x', niveauInherent: 6, niveauResiduel: 6 }, { organizationId: 'y', niveauInherent: 6, niveauResiduel: 6 }],
      [{ organizationId: 'y', statut: 'A_FAIRE', echeance: '2020-01-01' }],
      now,
    )
    expect(rows.map(r => r.orgId)).toEqual(['y', 'x'])
  })
})
