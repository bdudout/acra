import { describe, expect, it } from 'vitest'
import { cleanUsageCriticality, usageCriticalityGap } from '@/lib/tier-offers'

describe('criticité d’un usage de service', () => {
  it('absente ou vide = non renseignée (null) ; valeur connue conservée ; inconnue refusée', () => {
    expect(cleanUsageCriticality(undefined)).toEqual({ ok: true, value: null })
    expect(cleanUsageCriticality('')).toEqual({ ok: true, value: null })
    expect(cleanUsageCriticality('CRITIQUE')).toEqual({ ok: true, value: 'CRITIQUE' })
    expect(cleanUsageCriticality('urgent')).toEqual({ ok: false, error: 'criticite_invalide' })
  })
  it('écart : un usage plus critique que le contrat qui le couvre est signalé (jamais l’inverse, jamais sans contrat)', () => {
    expect(usageCriticalityGap('CRITIQUE', 'NON_CRITIQUE')).toBe(true)
    expect(usageCriticalityGap('IMPORTANTE', 'NON_CRITIQUE')).toBe(true)
    expect(usageCriticalityGap('CRITIQUE', 'IMPORTANTE')).toBe(true)
    expect(usageCriticalityGap('IMPORTANTE', 'CRITIQUE')).toBe(false)
    expect(usageCriticalityGap('NON_CRITIQUE', 'NON_CRITIQUE')).toBe(false)
    expect(usageCriticalityGap(null, 'NON_CRITIQUE')).toBe(false)
    expect(usageCriticalityGap('CRITIQUE', null)).toBe(false)
  })
})
