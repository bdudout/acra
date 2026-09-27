import { describe, expect, it } from 'vitest'
import { buildHistoricExcelIdempotencyKey } from '@/lib/historic-import-idempotency'

describe('buildHistoricExcelIdempotencyKey', () => {
  const source = 'classeur-base64'
  const base = {
    mappings: { Risques: { title: 'Titre', gravity: 'Impact' } },
    sheetTypes: { Risques: 'RISKS' },
    transforms: {},
    statusMappings: {},
    scoreMappings: {},
    partialImport: true,
  }

  it('est stable pour exactement le même fichier et les mêmes choix', () => {
    expect(buildHistoricExcelIdempotencyKey(source, base)).toBe(buildHistoricExcelIdempotencyKey(source, base))
  })

  it('différencie les choix qui changent les données importées', () => {
    expect(buildHistoricExcelIdempotencyKey(source, base)).not.toBe(buildHistoricExcelIdempotencyKey(source, { ...base, sheetTypes: { Risques: 'ACTIONS' } }))
    expect(buildHistoricExcelIdempotencyKey(source, base)).not.toBe(buildHistoricExcelIdempotencyKey(source, { ...base, statusMappings: { Mesures: { Fait: 'REALISE' } } }))
    expect(buildHistoricExcelIdempotencyKey(source, base)).not.toBe(buildHistoricExcelIdempotencyKey(source, { ...base, scoreMappings: { Risques: { gravity: { Critique: '4' } } } }))
    expect(buildHistoricExcelIdempotencyKey(source, base)).not.toBe(buildHistoricExcelIdempotencyKey(source, { ...base, rowOverrides: { Risques: { '8': { title: 'Risque complété' } } } }))
    expect(buildHistoricExcelIdempotencyKey(source, { ...base, organizationId: 'org-a' })).not.toBe(buildHistoricExcelIdempotencyKey(source, { ...base, organizationId: 'org-b' }))
  })
})
