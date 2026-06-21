import { describe, it, expect } from 'vitest'
import { orgInitials, orgLogoColors, hashSeed } from '@/lib/org-logo'

describe('org-logo — logo déterministe par organisation', () => {
  it('hashSeed est déterministe et stable', () => {
    expect(hashSeed('org_a')).toBe(hashSeed('org_a'))
    expect(hashSeed('org_a')).not.toBe(hashSeed('org_b'))
  })

  it('orgInitials extrait 1 à 2 lettres pertinentes', () => {
    expect(orgInitials('Groupe Démo')).toBe('GD')
    expect(orgInitials('Acme')).toBe('AC')
    expect(orgInitials('  entité paris ')).toBe('EP')
    expect(orgInitials('')).toBe('?')
  })

  it('orgLogoColors retourne deux couleurs HSL valides et déterministes', () => {
    const c1 = orgLogoColors('org_a')
    const c2 = orgLogoColors('org_a')
    expect(c1).toEqual(c2)               // déterministe
    expect(c1.from).toMatch(/^hsl\(/)
    expect(c1.to).toMatch(/^hsl\(/)
    expect(orgLogoColors('org_b').from).not.toBe(c1.from) // varie selon la graine
  })
})
