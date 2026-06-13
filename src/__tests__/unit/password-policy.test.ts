import { describe, it, expect } from 'vitest'
import { validatePassword, isPasswordExpired, generateCompliantPassword, DEFAULT_POLICY } from '@/lib/password-policy'

const basePolicy = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSpecial: false,
  maxAgeDays: 0,
}

describe('generateCompliantPassword', () => {
  it('génère un mot de passe respectant la politique par défaut (ANSSI)', () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generateCompliantPassword(DEFAULT_POLICY)
      expect(validatePassword(pwd, DEFAULT_POLICY)).toEqual([])
    }
  })

  it('respecte une longueur minimale élevée', () => {
    const policy = { ...DEFAULT_POLICY, minLength: 20 }
    const pwd = generateCompliantPassword(policy)
    expect(pwd.length).toBeGreaterThanOrEqual(20)
    expect(validatePassword(pwd, policy)).toEqual([])
  })

  it('génère sans classe requise (longueur seulement)', () => {
    const policy = { minLength: 10, requireUppercase: false, requireLowercase: false, requireNumbers: false, requireSpecial: false, maxAgeDays: 0 }
    const pwd = generateCompliantPassword(policy)
    expect(pwd.length).toBeGreaterThanOrEqual(10)
    expect(validatePassword(pwd, policy)).toEqual([])
  })

  it('produit des valeurs différentes à chaque appel', () => {
    const a = generateCompliantPassword(DEFAULT_POLICY)
    const b = generateCompliantPassword(DEFAULT_POLICY)
    expect(a).not.toBe(b)
  })
})

describe('validatePassword', () => {
  it('accepte un mot de passe valide avec la policy par défaut', () => {
    const errors = validatePassword('abcdefgh', basePolicy)
    expect(errors).toHaveLength(0)
  })

  it('rejette un mot de passe trop court (code minLength)', () => {
    const errors = validatePassword('abc', basePolicy)
    expect(errors).toContain('minLength')
  })

  it('retourne des codes de règle, pas des phrases', () => {
    const policy = { ...basePolicy, requireUppercase: true, requireNumbers: true, requireSpecial: true }
    expect(validatePassword('abc', policy).sort()).toEqual(['digit', 'minLength', 'special', 'uppercase'])
  })

  it('exige une majuscule', () => {
    const policy = { ...basePolicy, requireUppercase: true }
    expect(validatePassword('abcdefgh', policy)).not.toHaveLength(0)
    expect(validatePassword('Abcdefgh', policy)).toHaveLength(0)
  })

  it('exige une minuscule', () => {
    const policy = { ...basePolicy, requireLowercase: true }
    expect(validatePassword('ABCDEFGH', policy)).not.toHaveLength(0)
    expect(validatePassword('ABCDEFGh', policy)).toHaveLength(0)
  })

  it('exige un chiffre', () => {
    const policy = { ...basePolicy, requireNumbers: true }
    expect(validatePassword('abcdefgh', policy)).not.toHaveLength(0)
    expect(validatePassword('abcdefg1', policy)).toHaveLength(0)
  })

  it('exige un caractère spécial', () => {
    const policy = { ...basePolicy, requireSpecial: true }
    expect(validatePassword('abcdefgh', policy)).not.toHaveLength(0)
    expect(validatePassword('abcdefg!', policy)).toHaveLength(0)
  })

  it('cumule plusieurs erreurs', () => {
    const policy = { ...basePolicy, minLength: 10, requireNumbers: true, requireSpecial: true }
    const errors = validatePassword('abc', policy)
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })
})

describe('isPasswordExpired', () => {
  it('retourne false si maxAgeDays = 0 (pas d\'expiration)', () => {
    const old = new Date(2000, 0, 1)
    expect(isPasswordExpired(old, 0)).toBe(false)
  })

  it('retourne false si le mot de passe est récent', () => {
    const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // il y a 10 jours
    expect(isPasswordExpired(recent, 90)).toBe(false)
  })

  it('retourne true si le mot de passe a expiré', () => {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // il y a 100 jours
    expect(isPasswordExpired(old, 90)).toBe(true)
  })

  it('retourne false si passwordChangedAt est null (jamais changé, pas d\'expiration forcée)', () => {
    expect(isPasswordExpired(null, 90)).toBe(false)
  })
})
