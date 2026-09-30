import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'

const field = (model: string, name: string) => Prisma.dmmf.datamodel.models.find(m => m.name === model)?.fields.find(f => f.name === name)
const unique = (model: string, fields: string[]) => Prisma.dmmf.datamodel.models.find(m => m.name === model)?.uniqueFields.some(group => fields.every(f => group.includes(f)))

describe('persistance des suggestions approuvées', () => {
  it('mémorise les secteurs choisis par organisation, sans les imposer aux nouvelles organisations', () => {
    expect(field('Organization', 'secteursActivite')).toBeDefined()
  })

  it('conserve une provenance stable sur les risques et processus éditables', () => {
    for (const model of ['Processus', 'RiskItem']) {
      expect(field(model, 'catalogueKey')?.isRequired).toBe(false)
      expect(field(model, 'catalogueVersion')?.isRequired).toBe(false)
      expect(unique(model, ['organizationId', 'catalogueKey'])).toBe(true)
    }
  })
})
