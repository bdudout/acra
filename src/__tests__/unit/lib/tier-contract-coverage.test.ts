import { describe, expect, it } from 'vitest'
import { decideBeneficiaryTransition, validateServiceUsage } from '@/lib/tier-contract-coverage'

const orgs = { groupOrgId: 'group', beneficiaryOrgId: 'subsidiary', groupRootOfBeneficiary: 'group' }

describe('decideBeneficiaryTransition — contrat groupe', () => {
  it('la proposition par l’ADMIN groupe ne rend pas le contrat utilisable avant confirmation', () => {
    expect(decideBeneficiaryTransition({ ...orgs, actorOrgId: 'group', actorRole: 'ADMIN', action: 'PROPOSE', currentStatus: null }))
      .toEqual({ ok: true, nextStatus: 'PROPOSED' })
  })

  it('la filiale confirme sa propre couverture, jamais celle d’une autre filiale', () => {
    expect(decideBeneficiaryTransition({ ...orgs, actorOrgId: 'subsidiary', actorRole: 'ADMIN', action: 'CONFIRM', currentStatus: 'PROPOSED' }))
      .toEqual({ ok: true, nextStatus: 'CONFIRMED' })
    expect(decideBeneficiaryTransition({ ...orgs, actorOrgId: 'other', actorRole: 'ADMIN', action: 'CONFIRM', currentStatus: 'PROPOSED' }))
      .toEqual({ ok: false, error: 'not_beneficiary_admin' })
  })

  it('refuse une filiale extérieure au groupe et une confirmation sans proposition', () => {
    expect(decideBeneficiaryTransition({ ...orgs, groupRootOfBeneficiary: 'another-group', actorOrgId: 'group', actorRole: 'ADMIN', action: 'PROPOSE', currentStatus: null }))
      .toEqual({ ok: false, error: 'outside_group' })
    expect(decideBeneficiaryTransition({ ...orgs, actorOrgId: 'subsidiary', actorRole: 'ADMIN', action: 'CONFIRM', currentStatus: null }))
      .toEqual({ ok: false, error: 'not_proposed' })
  })

  it('réserve la proposition à l’ADMIN groupe et la confirmation à l’ADMIN filiale', () => {
    expect(decideBeneficiaryTransition({ ...orgs, actorOrgId: 'subsidiary', actorRole: 'ADMIN', action: 'PROPOSE', currentStatus: null }))
      .toEqual({ ok: false, error: 'not_group_admin' })
    expect(decideBeneficiaryTransition({ ...orgs, actorOrgId: 'subsidiary', actorRole: 'RISK_MANAGER', action: 'CONFIRM', currentStatus: 'PROPOSED' }))
      .toEqual({ ok: false, error: 'not_beneficiary_admin' })
  })
})

describe('validateServiceUsage — offre, contrat, filiale, processus et cas', () => {
  const base = {
    organizationId: 'subsidiary', processOrganizationId: 'subsidiary', serviceId: 'signature-offer',
    serviceAccessible: true, useCase: 'Signature des contrats fournisseurs',
    contractService: { id: 'contract-service-1', contractId: 'group-contract', serviceId: 'signature-offer' },
    beneficiary: { contractId: 'group-contract', organizationId: 'subsidiary', status: 'CONFIRMED' as const },
    contractOwnerOrganizationId: 'group',
  }

  it('accepte plusieurs usages du même service de signature pour des processus différents', () => {
    expect(validateServiceUsage(base)).toEqual({ ok: true, coverage: 'CONFIRMED' })
    expect(validateServiceUsage({ ...base, useCase: 'Signature des contrats de travail' }))
      .toEqual({ ok: true, coverage: 'CONFIRMED' })
  })

  it('ne confond pas deux offres d’hébergement ayant le même type de service', () => {
    expect(validateServiceUsage({ ...base, serviceId: 'hosting-b', contractService: { ...base.contractService, serviceId: 'hosting-a' } }))
      .toEqual({ ok: false, error: 'service_not_covered' })
  })

  it('refuse un usage par une filiale non confirmée ou hors périmètre du processus', () => {
    expect(validateServiceUsage({ ...base, beneficiary: { ...base.beneficiary, status: 'PROPOSED' } }))
      .toEqual({ ok: false, error: 'beneficiary_not_confirmed' })
    expect(validateServiceUsage({ ...base, processOrganizationId: 'other-subsidiary' }))
      .toEqual({ ok: false, error: 'process_outside_organization' })
  })

  it('permet un usage sans contrat connu mais le signale explicitement comme non couvert', () => {
    expect(validateServiceUsage({ ...base, contractService: null, beneficiary: null }))
      .toEqual({ ok: true, coverage: 'UNCONFIRMED' })
    expect(validateServiceUsage({ ...base, contractService: null, beneficiary: null, serviceAccessible: false }))
      .toEqual({ ok: false, error: 'service_not_accessible' })
  })

  it('autorise le contrat porté directement par l’organisation utilisatrice sans qualité de filiale bénéficiaire', () => {
    expect(validateServiceUsage({ ...base, beneficiary: null, contractOwnerOrganizationId: 'subsidiary' }))
      .toEqual({ ok: true, coverage: 'CONFIRMED' })
  })

  it('exige un cas d’usage explicite et cohérent avec le contrat choisi', () => {
    expect(validateServiceUsage({ ...base, useCase: '  ' })).toEqual({ ok: false, error: 'use_case_required' })
    expect(validateServiceUsage({ ...base, beneficiary: { ...base.beneficiary, contractId: 'another-contract' } }))
      .toEqual({ ok: false, error: 'beneficiary_contract_mismatch' })
  })
})
