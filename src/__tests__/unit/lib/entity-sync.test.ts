import { describe, expect, it } from 'vitest'
import { fetchRestEntities, mergeEntitySyncConfig, normalizeExternalEntities, publicEntitySyncConfig, validateLdapEndpoint, validateSyncEndpoint } from '@/lib/entity-sync'

describe('entity-sync', () => {
  it('refuse les destinations privées ou non HTTPS afin de prévenir le SSRF', () => {
    expect(validateSyncEndpoint('http://example.test/api')).toBeNull()
    expect(validateSyncEndpoint('https://127.0.0.1/admin')).toBeNull()
    expect(validateSyncEndpoint('https://[::1]/admin')).toBeNull()
    expect(validateSyncEndpoint('https://[fe80::1]/admin')).toBeNull()
    expect(validateSyncEndpoint('https://directory.example.test/api')).toBe('https://directory.example.test/api')
    expect(validateLdapEndpoint('ldap://directory.example.test')).toBeNull()
    expect(validateLdapEndpoint('ldaps://localhost')).toBeNull()
    expect(validateLdapEndpoint('ldaps://directory.example.test:636')).toBe('ldaps://directory.example.test:636')
  })

  it('normalise et dédoublonne les entités REST ou LDAP avant aperçu', () => {
    expect(normalizeExternalEntities([{ displayName: ' DSI ' }, { cn: 'DSI' }, { name: 'Risques' }, { name: '' }])).toEqual(['DSI', 'Risques'])
  })

  it('lit une collection REST sans suivre les redirections', async () => {
    const fetcher = async (_url: string, init?: RequestInit) => new Response(JSON.stringify({ items: [{ name: 'Finance' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    await expect(fetchRestEntities('https://directory.example.test/api', 'token', fetcher)).resolves.toEqual(['Finance'])
  })

  it('refuse une réponse REST dont la taille annoncée dépasse la borne de sécurité', async () => {
    const fetcher = async () => new Response('[]', { status: 200, headers: { 'content-length': String(1_048_577) } })
    await expect(fetchRestEntities('https://directory.example.test/api', null, fetcher)).rejects.toThrow('response_too_large')
  })

  it('préserve les secrets chiffrés quand l’administrateur ne les ressaisit pas et ne les expose jamais', () => {
    const saved = mergeEntitySyncConfig(
      { type: 'REST', endpoint: 'https://directory.example.test/v1/entities', token: 'enc:v1:already-encrypted' },
      { type: 'REST', endpoint: 'https://directory.example.test/v2/entities', token: '[CONFIGURED]' }
    )
    expect(saved.token).toBe('enc:v1:already-encrypted')
    expect(publicEntitySyncConfig(saved)).toEqual({
      type: 'REST', endpoint: 'https://directory.example.test/v2/entities', token: '[CONFIGURED]', password: '', bindDN: '', baseDN: '', filter: '', sourceVerite: 'ACRA',
    })
  })

  it('expose le choix de la source de vérité (ACRA par défaut, annuaire si l’administrateur l’a choisi)', () => {
    const saved = mergeEntitySyncConfig({}, { type: 'LDAP', endpoint: 'ldaps://d.example.test', sourceVerite: 'ANNUAIRE' })
    expect(publicEntitySyncConfig(saved).sourceVerite).toBe('ANNUAIRE')
  })
})
