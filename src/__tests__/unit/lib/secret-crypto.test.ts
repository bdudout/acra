import { describe, it, expect, beforeAll } from 'vitest'

// Clé de test fixée AVANT l'import du module (la clé est lue paresseusement à l'appel).
beforeAll(() => {
  process.env.SECRETS_ENCRYPTION_KEY = 'test-key-aes-256-gcm-acra-unit-tests-0123456789'
})

import { encryptSecret, decryptSecret } from '@/lib/secret-crypto'

describe('secret-crypto — chiffrement AES-256-GCM des secrets au repos (CWE-312)', () => {
  it('round-trip : déchiffrer(chiffrer(x)) === x', () => {
    const plain = 'sk-twilio-Auth-Token-très-secret'
    const enc = encryptSecret(plain)!
    expect(enc).not.toBe(plain)
    expect(enc.startsWith('enc:v1:')).toBe(true)
    expect(decryptSecret(enc)).toBe(plain)
  })

  it('produit un ciphertext différent à chaque appel (IV aléatoire)', () => {
    const a = encryptSecret('même-secret')
    const b = encryptSecret('même-secret')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('même-secret')
    expect(decryptSecret(b)).toBe('même-secret')
  })

  it('préserve null / undefined / chaîne vide (pas de faux secret)', () => {
    expect(encryptSecret(null)).toBeNull()
    expect(encryptSecret(undefined)).toBeUndefined()
    expect(encryptSecret('')).toBe('')
    expect(decryptSecret(null)).toBeNull()
  })

  it('rétro-compatibilité : une valeur en clair (legacy) est renvoyée telle quelle', () => {
    // Pas de préfixe enc:v1: → considérée comme legacy plaintext, lue transparente.
    expect(decryptSecret('ancien-secret-en-clair')).toBe('ancien-secret-en-clair')
  })

  it('idempotence : chiffrer une valeur déjà chiffrée ne double pas le chiffrement', () => {
    const enc = encryptSecret('abc')!
    expect(encryptSecret(enc)).toBe(enc)
  })

  it('détecte l\'altération (auth tag GCM) et renvoie null', () => {
    const enc = encryptSecret('intègre')!
    // Corrompt le dernier caractère du ciphertext
    const tampered = enc.slice(0, -1) + (enc.endsWith('A') ? 'B' : 'A')
    expect(decryptSecret(tampered)).toBeNull()
  })
})
