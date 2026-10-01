import { describe, expect, it } from 'vitest'
import { cleanServiceInput, planCoverageChange, usageCoverage } from '@/lib/tier-offers'

describe('cleanServiceInput — offre d’un prestataire', () => {
  it('nettoie nom, catégorie (défaut AUTRE) et description', () => {
    expect(cleanServiceInput({ nom: '  SignNow Signature ', typeService: 'LOGICIEL', description: ' Signature électronique ' })).toEqual({ ok: true, value: { nom: 'SignNow Signature', typeService: 'LOGICIEL', description: 'Signature électronique' } })
    expect(cleanServiceInput({ nom: 'Offre' })).toEqual({ ok: true, value: { nom: 'Offre', typeService: 'AUTRE', description: null } })
  })
  it('refuse nom vide ou trop long, catégorie inconnue, description démesurée', () => {
    expect(cleanServiceInput({ nom: '' })).toEqual({ ok: false, error: 'nom_requis' })
    expect(cleanServiceInput({ nom: 'x'.repeat(201) })).toEqual({ ok: false, error: 'nom_trop_long' })
    expect(cleanServiceInput({ nom: 'A', typeService: 'MAGIE' })).toEqual({ ok: false, error: 'type_invalide' })
    expect(cleanServiceInput({ nom: 'A', description: 'x'.repeat(10001) })).toEqual({ ok: false, error: 'description_trop_longue' })
  })
})

describe('planCoverageChange — offres couvertes par un contrat', () => {
  it('calcule les ajouts et retraits', () => {
    expect(planCoverageChange(['s1', 's2'], ['s2', 's3'], {})).toEqual({ toAdd: ['s3'], toRemove: ['s1'], blocked: [] })
  })
  it('un retrait encore utilisé par des usages est bloqué (jamais d’usage silencieusement décroché)', () => {
    expect(planCoverageChange(['s1', 's2'], ['s2'], { s1: 2 })).toEqual({ toAdd: [], toRemove: [], blocked: [{ serviceId: 's1', usages: 2 }] })
  })
  it('déduplique la demande et ignore les identifiants vides', () => {
    expect(planCoverageChange([], ['s1', 's1', ''], {})).toEqual({ toAdd: ['s1'], toRemove: [], blocked: [] })
  })
})

describe('usageCoverage — couverture contractuelle d’un usage', () => {
  it('sans contrat : à confirmer ; contrat de l’organisation : confirmée ; contrat groupe : seulement si bénéficiaire confirmé', () => {
    expect(usageCoverage({ organizationId: 'f1', contractService: null })).toBe('UNCONFIRMED')
    expect(usageCoverage({ organizationId: 'f1', contractService: { ownerOrganizationId: 'f1', beneficiaryStatus: null } })).toBe('CONFIRMED')
    expect(usageCoverage({ organizationId: 'f1', contractService: { ownerOrganizationId: 'grp', beneficiaryStatus: 'CONFIRMED' } })).toBe('CONFIRMED')
    expect(usageCoverage({ organizationId: 'f1', contractService: { ownerOrganizationId: 'grp', beneficiaryStatus: 'PROPOSED' } })).toBe('UNCONFIRMED')
    expect(usageCoverage({ organizationId: 'f1', contractService: { ownerOrganizationId: 'grp', beneficiaryStatus: 'REJECTED' } })).toBe('UNCONFIRMED')
    expect(usageCoverage({ organizationId: 'f1', contractService: { ownerOrganizationId: 'grp', beneficiaryStatus: null } })).toBe('UNCONFIRMED')
  })
})
