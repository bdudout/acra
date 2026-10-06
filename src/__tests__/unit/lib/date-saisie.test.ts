/** Date saisie (champ date AAAA-MM-JJ ou ISO) → Date, null pour effacer, undefined si illisible (champ ignoré). */
import { describe, expect, it } from 'vitest'
import { dateSaisie } from '@/lib/date-saisie'

describe('dateSaisie', () => {
  it('AAAA-MM-JJ → minuit UTC ; ISO conservé ; vide / null → null ; illisible → undefined', () => {
    expect(dateSaisie('2026-10-26')?.toISOString()).toBe('2026-10-26T00:00:00.000Z')
    expect(dateSaisie('2026-10-26T12:30:00.000Z')?.toISOString()).toBe('2026-10-26T12:30:00.000Z')
    expect(dateSaisie('')).toBeNull()
    expect(dateSaisie(null)).toBeNull()
    expect(dateSaisie('demain')).toBeUndefined()
    expect(dateSaisie(42)).toBeUndefined()
  })
})
