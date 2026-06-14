import { describe, it, expect } from 'vitest'
import {
  generateCode,
  hashCode,
  verifyCode,
  isExpired,
  MFA_CODE_DIGITS,
  MFA_TTL_MS,
  MFA_MAX_ATTEMPTS,
} from '@/lib/mfa'

const SECRET = 'test-secret-key-1234567890'

describe('mfa — génération de code', () => {
  it('génère un code numérique de la bonne longueur', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateCode()
      expect(c).toHaveLength(MFA_CODE_DIGITS)
      expect(/^[0-9]+$/.test(c)).toBe(true)
    }
  })

  it('respecte une longueur personnalisée et reste zéro-paddé', () => {
    const c = generateCode(4)
    expect(c).toHaveLength(4)
    expect(/^[0-9]{4}$/.test(c)).toBe(true)
  })

  it('produit des codes variés (non constants)', () => {
    const set = new Set(Array.from({ length: 30 }, () => generateCode()))
    expect(set.size).toBeGreaterThan(1)
  })
})

describe('mfa — hachage et vérification', () => {
  it('hashCode est déterministe pour un même (code, secret)', () => {
    expect(hashCode('123456', SECRET)).toBe(hashCode('123456', SECRET))
  })

  it('hashCode diffère selon le code et selon le secret', () => {
    expect(hashCode('123456', SECRET)).not.toBe(hashCode('654321', SECRET))
    expect(hashCode('123456', SECRET)).not.toBe(hashCode('123456', 'autre-secret'))
  })

  it('ne stocke jamais le code en clair', () => {
    expect(hashCode('123456', SECRET)).not.toContain('123456')
  })

  it('verifyCode renvoie true pour le bon code, false sinon', () => {
    const h = hashCode('123456', SECRET)
    expect(verifyCode('123456', h, SECRET)).toBe(true)
    expect(verifyCode('000000', h, SECRET)).toBe(false)
  })

  it('verifyCode est robuste aux entrées vides/invalides', () => {
    const h = hashCode('123456', SECRET)
    expect(verifyCode('', h, SECRET)).toBe(false)
    expect(verifyCode('123456', '', SECRET)).toBe(false)
  })
})

describe('mfa — expiration', () => {
  it('isExpired true au-delà du TTL, false avant', () => {
    const now = Date.now()
    expect(isExpired(now + 1000, now)).toBe(false)
    expect(isExpired(now - 1000, now)).toBe(true)
  })

  it('accepte une Date comme échéance', () => {
    const now = Date.now()
    expect(isExpired(new Date(now + 1000), now)).toBe(false)
  })
})

describe('mfa — constantes', () => {
  it('expose des valeurs raisonnables', () => {
    expect(MFA_CODE_DIGITS).toBeGreaterThanOrEqual(6)
    expect(MFA_TTL_MS).toBeGreaterThan(0)
    expect(MFA_MAX_ATTEMPTS).toBeGreaterThanOrEqual(3)
  })
})
