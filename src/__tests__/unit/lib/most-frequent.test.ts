import { describe, it, expect } from 'vitest'
import { mostFrequentString } from '@/lib/most-frequent'

describe('mostFrequentString', () => {
  it('renvoie la valeur la plus fréquente (trim, ignore vides)', () => {
    expect(mostFrequentString(['DSI', 'DSI', 'Métier', '', null, undefined, ' DSI '])).toBe('DSI')
  })
  it('renvoie \'\' si aucune valeur exploitable', () => {
    expect(mostFrequentString(['', '  ', null, undefined])).toBe('')
    expect(mostFrequentString([])).toBe('')
  })
})
