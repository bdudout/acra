import { describe, expect, it } from 'vitest'
import { voyantAppetit, voyantMaturite, voyantKri, voyantGlobal } from '@/lib/ras-rad'

describe('voyants du tableau de bord d’appétence (RAD)', () => {
  it('appétit : gris sans risque évalué, vert sans dépassement, rouge sinon', () => {
    expect(voyantAppetit({ evalues: 0, horsAppetit: 0 })).toBe('GRIS')
    expect(voyantAppetit({ evalues: 5, horsAppetit: 0 })).toBe('VERT')
    expect(voyantAppetit({ evalues: 5, horsAppetit: 1 })).toBe('ROUGE')
  })

  it('maturité : gris sans évaluation, vert si rien sous la cible, orange pour un écart d’un niveau, rouge au-delà', () => {
    expect(voyantMaturite({ assessed: 0, belowTarget: 0, topGaps: [] })).toBe('GRIS')
    expect(voyantMaturite({ assessed: 4, belowTarget: 0, topGaps: [] })).toBe('VERT')
    expect(voyantMaturite({ assessed: 4, belowTarget: 2, topGaps: [{ gap: 1 }, { gap: 1 }] })).toBe('ORANGE')
    expect(voyantMaturite({ assessed: 4, belowTarget: 1, topGaps: [{ gap: 2 }] })).toBe('ROUGE')
  })

  it('KRI : gris sans KRI, rouge si critique, orange si alerte, vert sinon', () => {
    expect(voyantKri({ total: 0, alerte: 0, critique: 0 })).toBe('GRIS')
    expect(voyantKri({ total: 3, alerte: 0, critique: 1 })).toBe('ROUGE')
    expect(voyantKri({ total: 3, alerte: 1, critique: 0 })).toBe('ORANGE')
    expect(voyantKri({ total: 3, alerte: 0, critique: 0 })).toBe('VERT')
  })

  it('global : le pire voyant renseigné l’emporte, gris si rien n’est renseigné', () => {
    expect(voyantGlobal(['VERT', 'GRIS', 'ORANGE'])).toBe('ORANGE')
    expect(voyantGlobal(['VERT', 'ROUGE', 'ORANGE'])).toBe('ROUGE')
    expect(voyantGlobal(['GRIS', 'GRIS'])).toBe('GRIS')
    expect(voyantGlobal([])).toBe('GRIS')
  })
})
