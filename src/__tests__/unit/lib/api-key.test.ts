import { describe, it, expect } from 'vitest'
import {
  generateApiKey, hashApiKey, parseAuthorizationHeader, verifyApiKey, maskApiKey,
  cleanScopes, hasScope, apiKeyUtilisable, API_KEY_PREFIX,
} from '@/lib/api-key'

describe('generateApiKey / hashApiKey', () => {
  it('génère un jeton acra_<prefix>_<secret>', () => {
    const k = generateApiKey()
    expect(k.plaintext.startsWith(`${API_KEY_PREFIX}_${k.prefix}_`)).toBe(true)
  })
  it('hashApiKey : format salt$hash, salé (deux appels diffèrent), vérifiable', async () => {
    const k = generateApiKey()
    const h1 = await hashApiKey(k.plaintext)
    const h2 = await hashApiKey(k.plaintext)
    expect(h1).toMatch(/^[0-9a-f]{32}\$[0-9a-f]{64}$/)
    expect(h1).not.toBe(h2) // sel aléatoire
    expect(await verifyApiKey(k.plaintext, h1)).toBe(true)
  })
  it('deux appels donnent des jetons différents', () => {
    expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext)
  })
})

describe('parseAuthorizationHeader', () => {
  it('extrait préfixe + jeton d\'un Bearer valide', () => {
    const r = parseAuthorizationHeader('Bearer acra_ab12cd_secretpart')
    expect(r).toEqual({ prefix: 'ab12cd', plaintext: 'acra_ab12cd_secretpart' })
  })
  it('insensible à la casse de « Bearer »', () => {
    expect(parseAuthorizationHeader('bearer acra_x_y')?.prefix).toBe('x')
  })
  it('rejette les en-têtes invalides', () => {
    expect(parseAuthorizationHeader(null)).toBeNull()
    expect(parseAuthorizationHeader('acra_x_y')).toBeNull()          // pas de Bearer
    expect(parseAuthorizationHeader('Bearer autre_x_y')).toBeNull()  // mauvais préfixe
    expect(parseAuthorizationHeader('Bearer acra_')).toBeNull()      // malformé
  })
})

describe('verifyApiKey (temps constant)', () => {
  it('vrai pour le bon jeton, faux sinon', async () => {
    const k = generateApiKey()
    const h = await hashApiKey(k.plaintext)
    expect(await verifyApiKey(k.plaintext, h)).toBe(true)
    expect(await verifyApiKey(k.plaintext + 'x', h)).toBe(false)
    expect(await verifyApiKey(k.plaintext, '')).toBe(false)
    expect(await verifyApiKey(k.plaintext, 'garbage-no-dollar')).toBe(false)
  })
})

describe('scopes & utilisabilité', () => {
  it('cleanScopes : valeurs connues, défaut read', () => {
    expect(cleanScopes(['read', 'write', 'bogus'])).toEqual(['read', 'write'])
    expect(cleanScopes([])).toEqual(['read'])
    expect(cleanScopes('nope')).toEqual(['read'])
  })
  it('hasScope', () => {
    expect(hasScope(['read'], 'read')).toBe(true)
    expect(hasScope(['read'], 'write')).toBe(false)
  })
  it('maskApiKey ne révèle pas le secret', () => {
    expect(maskApiKey('ab12cd')).toBe('acra_ab12cd_••••••••')
  })
  it('apiKeyUtilisable : révoquée ou expirée → inutilisable', () => {
    const now = new Date('2026-06-01T00:00:00Z')
    expect(apiKeyUtilisable({}, now)).toBe(true)
    expect(apiKeyUtilisable({ revokedAt: '2026-05-01' }, now)).toBe(false)
    expect(apiKeyUtilisable({ expiresAt: '2026-05-01' }, now)).toBe(false)
    expect(apiKeyUtilisable({ expiresAt: '2026-12-31' }, now)).toBe(true)
  })
})
