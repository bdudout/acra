import { describe, it, expect } from 'vitest'
import { maskDestination } from '@/lib/mfa-service'

describe('mfa-service — maskDestination', () => {
  it('masque un e-mail en gardant la 1re lettre et le domaine', () => {
    expect(maskDestination('EMAIL', 'alice@example.com')).toBe('a***@example.com')
  })
  it('masque un numéro en gardant le préfixe et les 2 derniers chiffres', () => {
    expect(maskDestination('SMS', '+33612345689')).toBe('+33•••••89')
  })
  it('reste robuste sur une entrée e-mail invalide', () => {
    expect(maskDestination('EMAIL', 'pasdarobase')).toBe('***')
  })
})
