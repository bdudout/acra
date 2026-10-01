import { describe, it, expect, vi, beforeEach } from 'vitest'

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { apiKey: { findUnique } } }))

vi.mock('@/lib/api-key', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api-key')>()
  return { ...actual, verifyApiKey: vi.fn(actual.verifyApiKey) }
})
vi.mock('@/lib/rate-limit', () => {
  const hits = new Map<string, number>()
  return { rateLimit: async (key: string, limit: number) => { const n = (hits.get(key) ?? 0) + 1; hits.set(key, n); return { allowed: n <= limit, remaining: 0, resetAt: 0 } } }
})

import { lookupApiKey, LIMIT_API_KEY_AUTH } from '@/lib/api-key-lookup.server'
import { hashApiKey, generateApiKey, verifyApiKey } from '@/lib/api-key'

const req = (ip: string) => new Request('http://x/api', { headers: { 'x-forwarded-for': ip } })

describe('lookupApiKey (N04)', () => {
  beforeEach(() => findUnique.mockReset())

  it('accepte une clé valide, refuse un secret erroné et un préfixe inconnu avec le même statut', async () => {
    const k = generateApiKey()
    findUnique.mockResolvedValue({ id: 'k1', prefix: k.prefix, hashedKey: await hashApiKey(k.plaintext) })
    expect((await lookupApiKey(req('203.0.113.10'), { prefix: k.prefix, plaintext: k.plaintext })).status).toBe('ok')
    expect((await lookupApiKey(req('203.0.113.10'), { prefix: k.prefix, plaintext: k.plaintext + 'x' })).status).toBe('invalid')
    findUnique.mockResolvedValue(null)
    expect((await lookupApiKey(req('203.0.113.10'), { prefix: 'deadbeef0000', plaintext: 'acra_deadbeef0000_zzz' })).status).toBe('invalid')
  })

  it('limite les tentatives par IP AVANT toute dérivation scrypt', async () => {
    findUnique.mockResolvedValue(null)
    vi.mocked(verifyApiKey).mockResolvedValue(false) // évite 300 scrypt réels
    const ip = '198.51.100.77'
    let last = ''
    for (let i = 0; i <= LIMIT_API_KEY_AUTH.limit; i++) last = (await lookupApiKey(req(ip), { prefix: 'p', plaintext: 'acra_p_x' })).status
    expect(last).toBe('throttled')
    const calls = findUnique.mock.calls.length
    await lookupApiKey(req(ip), { prefix: 'p', plaintext: 'acra_p_x' })
    expect(findUnique.mock.calls.length).toBe(calls) // plus aucun accès DB ni scrypt une fois bloqué
  })
})
