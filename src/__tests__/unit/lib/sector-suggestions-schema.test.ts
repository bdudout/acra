import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { aUnique, estFacultatif } from './schema-prisma'

const field = (model: string, name: string) => Prisma.dmmf.datamodel.models.find(m => m.name === model)?.fields.find(f => f.name === name)

describe('persistance des suggestions approuvées', () => {
  it('mémorise les secteurs choisis par organisation, sans les imposer aux nouvelles organisations', () => {
    expect(field('Organization', 'secteursActivite')).toBeDefined()
  })

  it('conserve une provenance stable sur les risques et processus éditables', () => {
    for (const model of ['Processus', 'RiskItem']) {
      expect(estFacultatif(model, 'catalogueKey')).toBe(true)
      expect(estFacultatif(model, 'catalogueVersion')).toBe(true)
      expect(aUnique(model, ['organizationId', 'catalogueKey'])).toBe(true)
    }
  })
})
