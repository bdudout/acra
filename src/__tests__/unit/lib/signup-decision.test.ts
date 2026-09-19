import { describe, it, expect } from 'vitest'
import { resolveSignupDecision } from '@/lib/demo'

describe('resolveSignupDecision', () => {
  it('refuse tout amorçage public, même sur une démo prouvée', () => {
    expect(resolveSignupDecision({ isFirstUser: true, signupOpen: true })).toEqual({
      allowed: false,
    })
    expect(resolveSignupDecision({ isFirstUser: true, signupOpen: false })).toEqual({ allowed: false })
    // Une ouverture temporaire de l'inscription ne doit jamais devenir un bootstrap prod.
    expect(resolveSignupDecision({ isFirstUser: true, signupOpen: true })).toEqual({ allowed: false })
  })
  it('inscrit suivant avec inscription OUVERTE = org isolée + email verif + cap', () => {
    expect(resolveSignupDecision({ isFirstUser: false, signupOpen: true })).toEqual({
      allowed: true, instanceRole: 'ANALYSTE', provisionOrg: true, requireEmailVerif: true, enforceCap: true,
    })
  })
  it('inscrit suivant avec inscription FERMÉE = refusé (anti F004)', () => {
    expect(resolveSignupDecision({ isFirstUser: false, signupOpen: false })).toEqual({ allowed: false })
  })
})
