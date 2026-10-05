import { describe, expect, it } from 'vitest'
import { impactsGravite, IMPACT_TYPES } from '@/lib/echelle-legende'

describe('légende de la gravité : impacts par type et par niveau', () => {
  it('quatre types d’impact (opérationnel, financier, juridique, image), une ligne par niveau de l’échelle', () => {
    expect(IMPACT_TYPES).toEqual(['operationnel', 'financier', 'juridique', 'image'])
    expect(impactsGravite(4, 'fr')).toHaveLength(4)
    expect(impactsGravite(5, 'fr')).toHaveLength(5)
  })
  it('textes dans la langue, croissants d’un niveau à l’autre', () => {
    const fr = impactsGravite(4, 'fr'), en = impactsGravite(4, 'en')
    expect(fr[3].financier).toMatch(/survie/i)
    expect(en[3].financier).not.toBe(fr[3].financier)
    expect(new Set(fr.map(l => l.image)).size).toBe(4)
    expect(impactsGravite(5, 'fr')[4].operationnel).toMatch(/au-delà/i)
  })
})
