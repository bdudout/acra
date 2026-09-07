import { describe, it, expect } from 'vitest'
import { analyseGelee, STATUT_GEL } from '@/lib/gel-analyse'

describe('analyseGelee', () => {
  it('gèle uniquement si le gel est actif ET les risques acceptés', () => {
    expect(analyseGelee('ACCEPTES', true)).toBe(true)
    expect(STATUT_GEL).toBe('ACCEPTES')
  })

  it('ne gèle pas si la fonctionnalité est désactivée', () => {
    expect(analyseGelee('ACCEPTES', false)).toBe(false)
  })

  it('ne gèle pas les autres statuts (attente, refus)', () => {
    expect(analyseGelee('EN_ATTENTE', true)).toBe(false)
    expect(analyseGelee('REFUSES', true)).toBe(false)
    expect(analyseGelee(null, true)).toBe(false)
    expect(analyseGelee(undefined, true)).toBe(false)
  })
})
