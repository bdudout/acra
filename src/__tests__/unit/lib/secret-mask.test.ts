import { describe, it, expect, beforeAll } from 'vitest'
import { maskSecret, resolveSubmittedSecret, decryptSecret, encryptSecret, SECRET_PLACEHOLDER } from '@/lib/secret-crypto'

// Audit 2026-10-01 : les secrets d'instance (SMTP, SIEM, SSO, SMS) ne sont plus renvoyés en clair à l'UI.
beforeAll(() => { process.env.SECRETS_ENCRYPTION_KEY = 'cle-de-test-suffisamment-longue-pour-scrypt' })

describe('maskSecret / resolveSubmittedSecret', () => {
  it('l\'UI ne reçoit qu\'un marqueur', () => {
    expect(maskSecret(encryptSecret('s3cr3t'))).toBe(SECRET_PLACEHOLDER)
    expect(maskSecret(null)).toBeNull()
    expect(maskSecret('')).toBeNull()
  })
  it('marqueur renvoyé ou champ absent → secret stocké inchangé', () => {
    const stored = encryptSecret('s3cr3t')
    expect(resolveSubmittedSecret(SECRET_PLACEHOLDER, stored)).toBe(stored)
    expect(resolveSubmittedSecret(undefined, stored)).toBe(stored)
  })
  it('nouvelle valeur → chiffrée ; vide ou null → effacée', () => {
    const next = resolveSubmittedSecret('nouveau', encryptSecret('ancien'))
    expect(next).not.toBe('nouveau')
    expect(decryptSecret(next)).toBe('nouveau')
    expect(resolveSubmittedSecret('', encryptSecret('x'))).toBeNull()
    expect(resolveSubmittedSecret(null, encryptSecret('x'))).toBeNull()
  })
})
