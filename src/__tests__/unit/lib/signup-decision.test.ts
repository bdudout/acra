import { describe, it, expect } from 'vitest'
import { resolveSignupDecision } from '@/lib/demo'

describe('resolveSignupDecision', () => {
  it('tout premier compte = exploitant SUPER_ADMIN (toujours autorisé)', () => {
    expect(resolveSignupDecision({ isFirstUser: true, signupOpen: false })).toEqual({
      allowed: true, instanceRole: 'SUPER_ADMIN', provisionOrg: false, requireEmailVerif: false, enforceCap: false,
    })
    // même si l'inscription est ouverte, le 1er reste l'exploitant
    expect(resolveSignupDecision({ isFirstUser: true, signupOpen: true }).allowed).toBe(true)
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
