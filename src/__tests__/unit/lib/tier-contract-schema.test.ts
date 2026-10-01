import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { estFacultatif } from './schema-prisma'

const model = (name: string) => Prisma.dmmf.datamodel.models.find(m => m.name === name)
const field = (name: string, fieldName: string) => model(name)?.fields.find(f => f.name === fieldName)

describe('schéma tiers / services / contrats groupe', () => {
  it('porte une identité tier commune au groupe avec accès explicites par organisation', () => {
    expect(model('Tier')).toBeDefined()
    expect(field('Tier', 'rootOrganizationId')).toBeDefined()
    expect(model('TierOrganization')).toBeDefined()
    expect(field('TierOrganization', 'organizationId')).toBeDefined()
  })

  it('distingue offre, service couvert par contrat, bénéficiaire et usage local', () => {
    for (const name of ['TierService', 'TierContractService', 'TierContractBeneficiary', 'TierServiceUsage']) {
      expect(model(name), `${name} absent`).toBeDefined()
    }
    expect(field('TierService', 'typeService')).toBeDefined()
    expect(field('TierContractBeneficiary', 'status')).toBeDefined()
    expect(field('TierServiceUsage', 'useCase')).toBeDefined()
    expect(field('TierServiceUsage', 'processusId')).toBeDefined()
    expect(field('TierServiceUsage', 'contractServiceId')).toBeDefined()
  })

  it('relie les contrats TIC et parties prenantes historiques sans imposer un backfill automatique', () => {
    expect(estFacultatif('ArrangementTic', 'tierId')).toBe(true)
    expect(estFacultatif('PartiePrenante', 'tierId')).toBe(true)
  })
})
